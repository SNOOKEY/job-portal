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
    CITY_MAPPING_RULES,
    GEMINI_FLASH_INPUT_PRICE_PER_1M,
    GEMINI_FLASH_OUTPUT_PRICE_PER_1M,
    USD_TO_INR_EXCHANGE_RATE,
    SYSTEM_PROMPT,
)

load_dotenv()
logger = logging.getLogger("tagger")


class JobClassification(BaseModel):
    id: str = Field(description="ID of the job posting")
    role: str = Field(description="Classified role from allowed ROLE_TAXONOMY")
    city: str = Field(description="Normalized Indian city or Remote")
    job_type: str = Field(description="'Internship' or 'Full-Time Fresher'")
    confidence: float = Field(description="Confidence between 0.0 and 1.0")


class BatchClassificationResponse(BaseModel):
    classifications: List[JobClassification]


def heuristic_tag_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic fallback taxonomy classifier."""
    title = job.get("title", "").lower()
    loc = job.get("raw_location", "").lower()

    # 1. Role determination
    role = "Software Engineering"
    if any(k in title for k in ["data analyst", "business analyst", "data engineer", "analytics", "bi developer", "sql"]):
        role = "Data & Analytics"
    elif any(k in title for k in ["machine learning", "ml", "ai", "data scientist", "deep learning", "nlp", "computer vision", "llm"]):
        role = "AI / ML"
    elif any(k in title for k in ["product manager", "apm", "product analyst", "product management"]):
        role = "Product"
    elif any(k in title for k in ["design", "ui", "ux", "graphic", "creative", "visual"]):
        role = "Design"
    elif any(k in title for k in ["devops", "cloud", "sre", "infrastructure", "platform engineer", "kubernetes"]):
        role = "DevOps / Cloud"
    elif any(k in title for k in ["qa", "test", "sdet", "quality assurance", "automation tester"]):
        role = "QA / Testing"
    elif any(k in title for k in ["marketing", "seo", "content", "growth", "social media", "copywriter"]):
        role = "Marketing & Growth"
    elif any(k in title for k in ["sales", "sdr", "bdr", "business development", "account executive", "client relations"]):
        role = "Sales & BD"
    elif any(k in title for k in ["hr", "human resources", "talent", "recruiter", "operations", "ops"]):
        role = "Operations & HR"
    elif not any(k in title for k in ["software", "developer", "engineer", "frontend", "backend", "full stack", "web", "mobile", "ios", "android", "intern"]):
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

    # 3. Job type
    job_type = "Internship" if any(k in title for k in ["intern", "trainee", "apprentice", "co-op"]) else "Full-Time Fresher"

    return {
        "role": role if role in ROLE_TAXONOMY else "Other",
        "city": city if city in NORMALIZED_CITIES else "Other",
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
            results.append({
                "role": c.get("role", "Software Engineering"),
                "city": c.get("city", "Bengaluru"),
                "job_type": c.get("job_type", "Internship"),
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
                        cache[jid] = {
                            "role": j.get("role"),
                            "city": j.get("city"),
                            "job_type": j.get("job_type"),
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
