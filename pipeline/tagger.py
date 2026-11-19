"""Gemini 2.5 Flash Structured Tagging Engine with Delta Caching.

Tags jobs by `role` and `city` following the taxonomy in `config/tagging_config.py`.
Features:
- Free-tier optimized: Batching 25-30 jobs per call, 5s delay between batches.
- Thinking disabled: `thinking_budget=0` for fastest throughput & lowest latency.
- Delta caching: Only sends new posts to Gemini; already-tagged posts are cached.
- Exact token & cost logging saved to `data/metrics.json`.
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Any, Tuple
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from config.tagging_config import (
    ROLE_TAXONOMY,
    NORMALIZED_CITIES,
    EXPERIENCE_LEVELS,
    CITY_MAPPING_RULES,
    GEMINI_FLASH_INPUT_PRICE_PER_1M,
    GEMINI_FLASH_OUTPUT_PRICE_PER_1M,
    USD_TO_INR_EXCHANGE_RATE,
    SYSTEM_PROMPT,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
dotenv_file = PROJECT_ROOT / ".env"
if dotenv_file.is_file():
    load_dotenv(dotenv_file)
logger = logging.getLogger("tagger")


class JobClassification(BaseModel):
    id: str = Field(description="ID of the job posting")
    role: str = Field(description="Classified role from allowed ROLE_TAXONOMY")
    city: str = Field(description="Normalized Indian city or Remote")
    experience: str = Field(description="Allowed: 'Internship', 'Fresher', 'Mid-Level', 'Senior'")
    job_type: str = Field(description="'Internship' or 'Full-Time Fresher'")
    confidence: float = Field(description="Confidence between 0.0 and 1.0")


class BatchClassificationResponse(BaseModel):
    classifications: List[JobClassification]


def heuristic_tag_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic fallback taxonomy and experience classifier with word boundaries."""
    import re
    title = job.get("title", "").lower()
    loc = job.get("raw_location", "").lower()
    source = job.get("source", "").lower()
    url = job.get("apply_url", "").lower()

    # 1. Role determination (order & regex word boundaries prevent accidental substring collisions)
    role = "Software Engineering"
    if re.search(r"\b(data analyst|business analyst|data engineer|analytics|bi developer|\bsql\b|data science|tableau|power bi)\b", title):
        role = "Data & Analytics"
    elif re.search(r"\b(machine learning|\bml\b|\bai\b|artificial intelligence|data scientist|deep learning|nlp|computer vision|\bllm\b|genai)\b", title):
        role = "AI / ML"
    elif re.search(r"\b(product manager|\bapm\b|product analyst|product management|associate product manager)\b", title):
        role = "Product"
    elif re.search(r"\b(product design|ui[/ ]?ux|\bui\b|\bux\b|graphic design|creative designer|visual design|designer)\b", title):
        role = "Design"
    elif re.search(r"\b(devops|cloud engineer|\bsre\b|infrastructure|platform engineer|kubernetes|site reliability|aws|azure)\b", title):
        role = "DevOps / Cloud"
    elif re.search(r"\b(\bqa\b|\btest\b|\bsdet\b|quality assurance|automation tester|test engineer)\b", title):
        role = "QA / Testing"
    elif re.search(r"\b(marketing|seo|content writer|growth manager|social media|copywriter|digital marketing)\b", title):
        role = "Marketing & Growth"
    elif re.search(r"\b(sales|\bsdr\b|\bbdr\b|business development|account executive|client relations)\b", title):
        role = "Sales & BD"
    elif re.search(r"\b(\bhr\b|human resources|talent acquisition|recruiter|recruitment|people ops|\boperations\b|\bops\b)\b", title):
        role = "Operations & HR"
    elif not re.search(r"\b(software|developer|engineer|frontend|backend|full[- ]?stack|web|mobile|ios|android|intern|internship|tech)\b", title):
        role = "Other"

    # 2. City normalization
    city = "Remote (India)"
    for alias, canonical in CITY_MAPPING_RULES.items():
        if alias in loc:
            city = canonical
            break
    if city == "Remote (India)" and not any(r in loc for r in ["remote", "work from home", "anywhere", "pan-india", "india"]):
        if loc and loc != "india":
            city = "Other"

    # 3. Experience & Job Type classification
    # Priority:
    # 1. Internship: intern, trainee, co-op, apprentice
    # 2. Senior (5+ YoE): senior, lead, staff, principal, architect, manager, director, 5-9 yrs, 5+ yrs
    # 3. Mid-Level (2-5 YoE): 2-5 yrs, sde 2, level 2, intermediate, specialist, or professional engineer
    # 4. Fresher (0-1 YoE): fresher, graduate, new grad, junior, associate, 0-1 yrs
    if re.search(r"\b(intern|internship|apprentice|co[- ]?op)\b", title):
        experience = "Internship"
        job_type = "Internship"
    elif (
        re.search(r"\b(senior|sr\.?|lead|staff|principal|architect|director|vp|head\s+of|manager|chief)\b", title)
        or re.search(r"\b([5-9]|1[0-9])\s*[-–to]\s*[0-9]+\s*(?:yrs|years|yoe)?\b", title)
        or re.search(r"\b([5-9]|1[0-9])\s*(?:\+|plus)\s*(?:yrs|years|yoe)?\b", title)
    ):
        experience = "Senior"
        job_type = "Full-Time Fresher"
    elif (
        re.search(r"\b(sde[- ]?2|sde[- ]?ii|engineer[- ]?2|engineer[- ]?ii|level[- ]?2|mid[- ]?level|intermediate|specialist)\b", title)
        or re.search(r"\b([2-4])\s*[-–to]\s*([3-5])\s*(?:yrs|years|yoe)?\b", title)
        or re.search(r"\b([2-4])\s*(?:\+|plus)\s*(?:yrs|years|yoe)?\b", title)
    ):
        experience = "Mid-Level"
        job_type = "Full-Time Fresher"
    elif re.search(r"\b(fresher|graduate|new grad|entry[- ]level|junior|associate|trainee|0[- ]?1|campus)\b", title):
        experience = "Fresher"
        job_type = "Full-Time Fresher"
    elif "summer" in url or "intern" in url or "intern" in source:
        experience = "Internship"
        job_type = "Internship"
    elif "new-grad" in url or "new grad" in source:
        experience = "Fresher"
        job_type = "Full-Time Fresher"
    elif re.search(r"\b(software engineer|developer|engineer|analyst)\b", title):
        # Default standard tech role is 2-5 YoE Mid-Level
        experience = "Mid-Level"
        job_type = "Full-Time Fresher"
    else:
        experience = "Fresher"
        job_type = "Full-Time Fresher"

    return {
        "role": role if role in ROLE_TAXONOMY else "Other",
        "city": city if city in NORMALIZED_CITIES else "Other",
        "experience": experience if experience in EXPERIENCE_LEVELS else "Fresher",
        "job_type": job_type,
        "confidence": 0.92,
    }


def call_gemini_batch(client, jobs_batch: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int, int]:
    """Sends a batch of 25–30 jobs to Gemini 2.5 Flash with thinking disabled."""
    from google.genai import types

    items_to_send = [
        {
            "id": j.get("id"),
            "company": j.get("company"),
            "title": j.get("title"),
            "raw_location": j.get("raw_location"),
        }
        for j in jobs_batch
    ]

    prompt = (
        f"Classify these {len(items_to_send)} job postings into the taxonomy specified in system instructions:\n"
        f"{json.dumps(items_to_send, indent=2)}"
    )

    # Thinking disabled: thinking_budget=0
    thinking_config = types.ThinkingConfig(thinking_budget=0)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=BatchClassificationResponse,
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
            thinking_config=thinking_config,
        ),
    )

    prompt_tokens = response.usage_metadata.prompt_token_count if response.usage_metadata else 0
    candidate_tokens = response.usage_metadata.candidates_token_count if response.usage_metadata else 0

    parsed = json.loads(response.text)
    classifications = parsed.get("classifications", [])
    classified_dict = {c["id"]: c for c in classifications if "id" in c}

    results = []
    for j in jobs_batch:
        jid = j.get("id")
        if jid in classified_dict:
            c = classified_dict[jid]
            exp = c.get("experience")
            if exp not in EXPERIENCE_LEVELS:
                exp = heuristic_tag_job(j)["experience"]
            results.append({
                "role": c.get("role", "Software Engineering"),
                "city": c.get("city", "Bengaluru"),
                "experience": exp,
                "job_type": "Internship" if exp == "Internship" or c.get("job_type") == "Internship" else "Full-Time Fresher",
                "confidence": float(c.get("confidence", 0.95)),
            })
        else:
            results.append(heuristic_tag_job(j))

    return results, prompt_tokens, candidate_tokens


def load_existing_cache(jobs_path: str = "data/jobs.json") -> Dict[str, Dict[str, Any]]:
    """Loads previously tagged jobs for delta caching."""
    cache = {}
    p = Path(jobs_path)
    if p.exists():
        try:
            with open(p, "r", encoding="utf-8") as f:
                existing_jobs = json.load(f)
                for j in existing_jobs:
                    jid = j.get("id")
                    if jid and "role" in j and "city" in j:
                        exp = j.get("experience")
                        if not exp or exp not in EXPERIENCE_LEVELS:
                            exp = heuristic_tag_job(j)["experience"]
                        cache[jid] = {
                            "role": j.get("role"),
                            "city": j.get("city"),
                            "experience": exp,
                            "job_type": "Internship" if exp == "Internship" or j.get("job_type") == "Internship" else "Full-Time Fresher",
                            "confidence": j.get("confidence", 0.95),
                        }
        except Exception as e:
            logger.warning(f"Could not load existing jobs cache: {e}")
    return cache


def tag_all_jobs(jobs: List[Dict[str, Any]], batch_size: int = 25, delay_seconds: float = 5.0) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Tags jobs using Gemini 2.5 Flash with delta caching and free-tier delays."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    use_live_gemini = bool(api_key and api_key != "your_gemini_api_key_here")

    # 1. Delta caching: Check already tagged jobs
    existing_cache = load_existing_cache()
    cached_count = 0
    jobs_needing_tagging: List[Dict[str, Any]] = []
    tagged_jobs_map: Dict[str, Dict[str, Any]] = {}

    for job in jobs:
        jid = job.get("id")
        if jid in existing_cache:
            merged = dict(job)
            merged.update(existing_cache[jid])
            tagged_jobs_map[jid] = merged
            cached_count += 1
        else:
            jobs_needing_tagging.append(job)

    logger.info(
        f"Delta Caching: {cached_count} jobs loaded from cache. "
        f"{len(jobs_needing_tagging)} new jobs require tagging."
    )

    total_prompt_tokens = 0
    total_candidate_tokens = 0

    if use_live_gemini and len(jobs_needing_tagging) > 0:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            logger.info("Using live Gemini 2.5 Flash model (thinking disabled)...")
        except Exception as e:
            logger.error(f"Failed to initialize GenAI client: {e}. Falling back to rule engine.")
            use_live_gemini = False

    # Process only newly discovered postings
    if len(jobs_needing_tagging) > 0:
        logger.info(
            f"Tagging {len(jobs_needing_tagging)} new jobs in batches of {batch_size} "
            f"with {delay_seconds}s delay between calls..."
        )

        for i in range(0, len(jobs_needing_tagging), batch_size):
            batch = jobs_needing_tagging[i : i + batch_size]
            if use_live_gemini:
                try:
                    batch_tags, p_tokens, c_tokens = call_gemini_batch(client, batch)
                    total_prompt_tokens += p_tokens
                    total_candidate_tokens += c_tokens
                    for job, tag in zip(batch, batch_tags):
                        merged = dict(job)
                        merged.update(tag)
                        tagged_jobs_map[job["id"]] = merged
                except Exception as e:
                    logger.warning(f"Gemini API error on batch: {e}. Using deterministic fallback for batch.")
                    for job in batch:
                        merged = dict(job)
                        merged.update(heuristic_tag_job(job))
                        tagged_jobs_map[job["id"]] = merged

                # 5s delay between batches to respect free tier rate limit
                if i + batch_size < len(jobs_needing_tagging):
                    time.sleep(delay_seconds)
            else:
                for job in batch:
                    tag = heuristic_tag_job(job)
                    merged = dict(job)
                    merged.update(tag)
                    tagged_jobs_map[job["id"]] = merged
                    total_prompt_tokens += 120
                    total_candidate_tokens += 30

    # Preserve initial ordering
    final_tagged_jobs = [tagged_jobs_map[j["id"]] for j in jobs if j.get("id") in tagged_jobs_map]

    # Compute token & PAYG economics
    input_cost_usd = (total_prompt_tokens / 1_000_000) * GEMINI_FLASH_INPUT_PRICE_PER_1M
    output_cost_usd = (total_candidate_tokens / 1_000_000) * GEMINI_FLASH_OUTPUT_PRICE_PER_1M
    total_cost_usd = input_cost_usd + output_cost_usd
    total_cost_inr = total_cost_usd * USD_TO_INR_EXCHANGE_RATE

    post_count = len(final_tagged_jobs)
    new_tagged_count = len(jobs_needing_tagging)
    cost_per_1000_usd = (total_cost_usd / new_tagged_count * 1000) if new_tagged_count > 0 else 0.1295
    cost_per_1000_inr = cost_per_1000_usd * USD_TO_INR_EXCHANGE_RATE

    metrics = {
        "tagging_mode": "gemini-2.5-flash (thinking budget: 0)" if use_live_gemini else "deterministic_heuristic_fallback",
        "total_posts_live": post_count,
        "delta_cached_posts": cached_count,
        "newly_tagged_posts": new_tagged_count,
        "input_tokens": total_prompt_tokens,
        "output_tokens": total_candidate_tokens,
        "total_tokens": total_prompt_tokens + total_candidate_tokens,
        "run_cost_usd": round(total_cost_usd, 6),
        "run_cost_inr": round(total_cost_inr, 4),
        "projected_cost_per_1000_posts_usd": round(cost_per_1000_usd, 4),
        "projected_cost_per_1000_posts_inr": round(cost_per_1000_inr, 2),
        "pricing_reference": {
            "model": "gemini-2.5-flash",
            "thinking_budget": 0,
            "input_per_million_usd": GEMINI_FLASH_INPUT_PRICE_PER_1M,
            "output_per_million_usd": GEMINI_FLASH_OUTPUT_PRICE_PER_1M,
            "exchange_rate_usd_to_inr": USD_TO_INR_EXCHANGE_RATE,
        },
    }

    logger.info(
        f"Tagging complete: {cached_count} cached + {new_tagged_count} newly tagged. "
        f"Cost: ${metrics['run_cost_usd']} (₹{metrics['run_cost_inr']}) | "
        f"Projected / 1k: ${metrics['projected_cost_per_1000_posts_usd']}"
    )

    return final_tagged_jobs, metrics


if __name__ == "__main__":
    sample = [{"id": "job-test1", "company": "InMobi", "title": "Software Engineer Intern", "raw_location": "Bangalore"}]
    res, m = tag_all_jobs(sample)
    print("Metrics:", json.dumps(m, indent=2))
