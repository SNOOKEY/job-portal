"""Abstract Boolean Search Ingestion Engine for Job Postings.

Allows fetching jobs dynamically via boolean dork queries (e.g.,
`"devops" "remote" site:boards.greenhouse.io` or `"intern" "india" site:jobs.lever.co`)
without requiring hardcoded company API configurations.

Execution Providers:
1. LLM Grounded Search (Gemini 2.5 Flash with Google Search Tool Grounding)
2. Abstract ATS Discoverer with full Boolean AST/RPN evaluation (AND/OR/NOT/Parens/Quotes)
3. Configurable Boolean Registry (`config/boolean_queries.json`)
"""

import argparse
import datetime
import hashlib
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, unquote
import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("boolean_fetcher")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
}

# Domain & semantic synonyms for technical job dorking
DOMAIN_SYNONYMS = {
    "india": [
        "india", "bangalore", "bengaluru", "hyderabad", "pune", "delhi", "gurgaon",
        "gurugram", "noida", "mumbai", "chennai", "kolkata", "ahmedabad"
    ],
    "remote": [
        "remote", "wfh", "work from home", "anywhere", "pan-india", "india", "bangalore", "bengaluru"
    ],
    "devops": [
        "devops", "devop", "sre", "site reliability", "cloud", "infrastructure", "platform", "kubernetes"
    ],
    "devop": [
        "devops", "devop", "sre", "site reliability", "cloud", "infrastructure", "platform", "kubernetes"
    ],
    "software engineer": [
        "software engineer", "software developer", "sde", "backend engineer", "frontend engineer", "full stack", "engineer"
    ],
    "intern": [
        "intern", "internship", "trainee", "apprentice"
    ],
    "data analyst": [
        "data analyst", "business analyst", "analytics", "bi developer", "data scientist"
    ],
    "data engineer": [
        "data engineer", "big data", "etl", "data platform"
    ]
}

# Known top tech ATS boards to discover across dynamically
DISCOVERABLE_ATS_TARGETS = {
    "greenhouse": [
        "razorpaysoftwareprivatelimited", "groww", "inmobi", "postman", "swiggy",
        "clevertap", "curefit", "dunzo", "urbancompany", "phonepe", "browserstack"
    ],
    "lever": [
        "paytm", "meesho", "cred", "hotstar", "unacademy"
    ],
    "ashby": [
        "headout", "ramp", "brex"
    ]
}


class BooleanDorkParser:
    """Parses boolean queries into tokens and extracts the ATS target."""

    @staticmethod
    def extract_site_and_ats(query: str) -> Tuple[Optional[str], str]:
        site_match = re.search(r"site:([^\s]+)", query, re.IGNORECASE)
        site = site_match.group(1).lower() if site_match else None

        ats_type = "greenhouse"
        if site:
            if "lever.co" in site:
                ats_type = "lever"
            elif "ashbyhq.com" in site:
                ats_type = "ashby"
            elif "greenhouse.io" in site:
                ats_type = "greenhouse"

        return site, ats_type

    @staticmethod
    def tokenize(query: str) -> List[str]:
        """Tokenizes a boolean query, supporting quotes, parens, operators, and words."""
        # Strip site:xxx directive
        clean_q = re.sub(r"site:[^\s]+", "", query, flags=re.IGNORECASE).strip()

        pattern = r'(\(|\)|\bAND\b|\bOR\b|\bNOT\b|"[^"]+"|[^\s()]+)'
        raw_tokens = re.findall(pattern, clean_q, re.IGNORECASE)

        tokens = []
        for t in raw_tokens:
            t_clean = t.strip()
            if not t_clean:
                continue
            up = t_clean.upper()
            if up in ["AND", "OR", "NOT", "(", ")"]:
                tokens.append(up)
            elif t_clean.startswith('"') and t_clean.endswith('"'):
                tokens.append(t_clean[1:-1])
            else:
                tokens.append(t_clean)

        # Insert implicit AND where adjacent literals exist
        explicit_tokens = []
        for i, tok in enumerate(tokens):
            explicit_tokens.append(tok)
            if i < len(tokens) - 1:
                next_tok = tokens[i + 1]
                if (tok not in ["AND", "OR", "NOT", "("]) and (next_tok not in ["AND", "OR", ")"]):
                    explicit_tokens.append("AND")

        return explicit_tokens

    @staticmethod
    def evaluate_term(term: str, haystack: str) -> bool:
        t = term.strip().lower()
        if not t:
            return True
        if t in DOMAIN_SYNONYMS:
            return any(re.search(r"\b" + re.escape(s) + r"\b", haystack) for s in DOMAIN_SYNONYMS[t])
        return bool(re.search(r"\b" + re.escape(t) + r"\b", haystack))

    @classmethod
    def evaluate(cls, tokens: List[str], haystack: str) -> bool:
        """Evaluates tokenized boolean expression using Shunting-Yard and RPN."""
        if not tokens:
            return True

        precedence = {"NOT": 3, "AND": 2, "OR": 1}
        output_queue = []
        op_stack = []

        for tok in tokens:
            if tok == "(":
                op_stack.append(tok)
            elif tok == ")":
                while op_stack and op_stack[-1] != "(":
                    output_queue.append(op_stack.pop())
                if op_stack and op_stack[-1] == "(":
                    op_stack.pop()
            elif tok in precedence:
                while op_stack and op_stack[-1] in precedence and precedence[op_stack[-1]] >= precedence[tok]:
                    output_queue.append(op_stack.pop())
                op_stack.append(tok)
            else:
                output_queue.append(tok)

        while op_stack:
            output_queue.append(op_stack.pop())

        eval_stack = []
        for item in output_queue:
            if item == "NOT":
                val = eval_stack.pop() if eval_stack else False
                eval_stack.append(not val)
            elif item == "AND":
                r = eval_stack.pop() if eval_stack else False
                l = eval_stack.pop() if eval_stack else False
                eval_stack.append(l and r)
            elif item == "OR":
                r = eval_stack.pop() if eval_stack else False
                l = eval_stack.pop() if eval_stack else False
                eval_stack.append(l or r)
            else:
                eval_stack.append(cls.evaluate_term(item, haystack))

        return eval_stack[0] if eval_stack else True


class BaseBooleanFetcher:
    """Abstract base class for boolean job fetchers."""

    def fetch(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        raise NotImplementedError


class GeminiGroundedBooleanFetcher(BaseBooleanFetcher):
    """Fetches jobs by executing Boolean dork searches using Gemini with Google Search Grounding."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    def fetch(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        if not self.is_available():
            logger.warning("Gemini API key not found. Skipping Gemini Grounded Search.")
            return []

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            prompt = (
                f"You are an autonomous technical recruiter fetching live job openings.\n"
                f"Execute a web search for the following boolean query:\n"
                f"QUERY: {query}\n\n"
                f"Extract up to {limit} REAL, active, currently open job postings found from this search.\n"
                f"Strict requirements:\n"
                f"1. Every posting must have an authentic, direct application URL on the ATS site (e.g. boards.greenhouse.io, jobs.lever.co, or jobs.ashbyhq.com).\n"
                f"2. Return ONLY a valid JSON array of objects with the following exact keys:\n"
                f"   - company (string)\n"
                f"   - title (string)\n"
                f"   - apply_url (string, absolute link to the job)\n"
                f"   - location (string, e.g. 'Bengaluru, India' or 'Remote')\n"
                f"   - role_category (one of: 'Software Engineering', 'DevOps / Cloud', 'Data & Analytics', 'AI / ML', 'Product', 'QA / Testing', 'Other')\n"
                f"   - experience_level (one of: 'Internship', 'Fresher', 'Mid-Level', 'Senior')\n"
                f"   - skills (list of strings, e.g. ['Docker', 'Kubernetes', 'AWS', 'Python'])\n"
                f"   - summary (brief 1-2 sentence description)\n"
                f"Return ONLY valid raw JSON without markdown backticks."
            )

            logger.info("Invoking Gemini 2.5 Flash with Google Search Grounding for query: %s", query)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    temperature=0.2,
                ),
            )

            text = response.text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```[a-zA-Z]*\n", "", text)
                text = re.sub(r"```$", "", text).strip()

            raw_jobs = json.loads(text)
            if not isinstance(raw_jobs, list):
                logger.warning("Gemini did not return a list of jobs.")
                return []

            normalized_jobs = []
            for item in raw_jobs:
                if not item.get("apply_url") or not item.get("title") or not item.get("company"):
                    continue

                url = item.get("apply_url", "").strip()
                title = item.get("title", "").strip()
                company = item.get("company", "").strip()
                loc = item.get("location", "Remote (India)").strip()

                job_id = f"dork_gemini_{hashlib.md5(url.encode()).hexdigest()[:12]}"
                normalized_jobs.append({
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": loc,
                    "raw_location": loc,
                    "role_category": item.get("role_category", "Software Engineering"),
                    "experience_level": item.get("experience_level", "Fresher"),
                    "job_type": "Internship" if "intern" in title.lower() else "Full-Time Fresher",
                    "apply_url": url,
                    "skills": item.get("skills", []),
                    "source": f"Boolean Dork (Gemini Grounded: {query[:30]}...)",
                    "date_posted": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "salary_raw": "Disclosed at ATS",
                    "verified": True,
                    "batch": "boolean_grounded",
                })

            logger.info("Gemini Grounded Search yielded %d live jobs.", len(normalized_jobs))
            return normalized_jobs

        except Exception as e:
            logger.error("Error during Gemini Grounded Boolean search: %s", e)
            return []


class AbstractATSBooleanDiscoverer(BaseBooleanFetcher):
    """Abstract ATS Discoverer that evaluates Boolean criteria across direct ATS boards."""

    def fetch(self, query: str, limit: int = 35) -> List[Dict[str, Any]]:
        _, ats_type = BooleanDorkParser.extract_site_and_ats(query)
        tokens = BooleanDorkParser.tokenize(query)

        logger.info(
            "Abstract ATS Discoverer running for ATS=%s with parsed tokens=%s",
            ats_type, tokens
        )

        board_targets = DISCOVERABLE_ATS_TARGETS.get(ats_type, DISCOVERABLE_ATS_TARGETS["greenhouse"])
        found_jobs = []

        for company_slug in board_targets:
            if len(found_jobs) >= limit:
                break
            try:
                board_jobs = self._query_ats_board(ats_type, company_slug)
                for bj in board_jobs:
                    haystack = f"{bj.get('title', '')} {bj.get('location', '')} {bj.get('company', '')}".lower()
                    if BooleanDorkParser.evaluate(tokens, haystack):
                        found_jobs.append(bj)
                        if len(found_jobs) >= limit:
                            break
            except Exception as e:
                logger.debug("Board discovery error for %s (%s): %s", company_slug, ats_type, e)
                continue

        logger.info("Abstract ATS Discoverer found %d jobs matching boolean query.", len(found_jobs))
        return found_jobs

    def _query_ats_board(self, ats_type: str, company: str) -> List[Dict[str, Any]]:
        results = []
        try:
            if ats_type == "greenhouse":
                url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
                resp = requests.get(url, headers=REQUEST_HEADERS, timeout=12)
                if resp.status_code == 200:
                    data = resp.json()
                    display_company = "Razorpay" if "razorpay" in company else company.capitalize()
                    for j in data.get("jobs", []):
                        title = j.get("title", "")
                        loc = j.get("location", {}).get("name", "") if isinstance(j.get("location"), dict) else ""
                        job_url = j.get("absolute_url")
                        if job_url and title:
                            results.append({
                                "id": f"gh_{company[:8]}_{j.get('id')}",
                                "company": display_company,
                                "title": title,
                                "location": loc or "Remote",
                                "raw_location": loc or "Remote",
                                "apply_url": job_url,
                                "source": f"Boolean Dork (boards.greenhouse.io/{company})",
                            })

            elif ats_type == "lever":
                url = f"https://api.lever.co/v0/postings/{company}?mode=json"
                resp = requests.get(url, headers=REQUEST_HEADERS, timeout=12)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list):
                        for j in data:
                            title = j.get("text", "")
                            cats = j.get("categories", {})
                            loc = cats.get("location", "") if isinstance(cats, dict) else ""
                            apply_url = j.get("hostedUrl") or j.get("applyUrl")
                            if apply_url and title:
                                results.append({
                                    "id": f"lever_{company[:8]}_{j.get('id')}",
                                    "company": company.capitalize(),
                                    "title": title,
                                    "location": loc or "Remote",
                                    "raw_location": loc or "Remote",
                                    "apply_url": apply_url,
                                    "source": f"Boolean Dork (jobs.lever.co/{company})",
                                })

            elif ats_type == "ashby":
                url = f"https://api.ashbyhq.com/posting-api/job-board/{company}"
                resp = requests.get(url, headers=REQUEST_HEADERS, timeout=12)
                if resp.status_code == 200:
                    data = resp.json()
                    for j in data.get("jobs", []):
                        title = j.get("title", "")
                        loc = j.get("location", "")
                        apply_url = j.get("jobUrl")
                        if apply_url and title:
                            results.append({
                                "id": f"ashby_{company[:8]}_{j.get('id')}",
                                "company": company.capitalize(),
                                "title": title,
                                "location": loc or "Remote",
                                "raw_location": loc or "Remote",
                                "apply_url": apply_url,
                                "source": f"Boolean Dork (jobs.ashbyhq.com/{company})",
                            })
        except Exception as e:
            logger.debug("Failed querying %s on %s: %s", company, ats_type, e)

        return results


class AbstractBooleanJobEngine:
    """Orchestrates boolean query execution, deduplication, and persistence."""

    def __init__(self):
        self.gemini_fetcher = GeminiGroundedBooleanFetcher()
        self.ats_discoverer = AbstractATSBooleanDiscoverer()

    def run_query(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Executes a boolean query using the best available provider."""
        logger.info("Executing Boolean Dork: %s", query)

        # 1. Try Gemini Grounded Search if available
        if self.gemini_fetcher.is_available():
            results = self.gemini_fetcher.fetch(query, limit=limit)
            if results:
                return results

        # 2. Fall back to Abstract ATS Boolean Discoverer
        return self.ats_discoverer.fetch(query, limit=limit)

    def run_all_configured(self) -> List[Dict[str, Any]]:
        """Loads boolean queries from config/boolean_queries.json and runs them."""
        config_path = PROJECT_ROOT / "config" / "boolean_queries.json"
        if not config_path.is_file():
            logger.error("Config not found at %s", config_path)
            return []

        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        if not config.get("enabled", True):
            logger.info("Boolean query fetching is disabled in config.")
            return []

        all_results = []
        for q_item in config.get("queries", []):
            q_str = q_item.get("query")
            if not q_str:
                continue
            jobs = self.run_query(q_str, limit=20)
            all_results.extend(jobs)
            time.sleep(1)

        return all_results

    def merge_and_save(self, new_jobs: List[Dict[str, Any]]) -> int:
        """Merges new jobs into data/jobs.json and web/public/data/jobs.json with deduplication."""
        if not new_jobs:
            logger.info("No new jobs to merge.")
            return 0

        jobs_file = PROJECT_ROOT / "data" / "jobs.json"
        existing_jobs = []
        if jobs_file.is_file():
            with open(jobs_file, "r", encoding="utf-8") as f:
                existing_jobs = json.load(f)

        existing_urls = {j.get("apply_url") for j in existing_jobs if j.get("apply_url")}
        existing_keys = {(j.get("company", "").lower(), j.get("title", "").lower()) for j in existing_jobs}

        added_count = 0
        from pipeline.tagger import heuristic_tag_job

        for j in new_jobs:
            url = j.get("apply_url")
            key = (j.get("company", "").lower(), j.get("title", "").lower())

            if url in existing_urls or key in existing_keys:
                continue

            # Tag using deterministic taxonomy
            tags = heuristic_tag_job(j)
            j["role_category"] = tags["role"]
            j["location"] = tags["city"]
            j["experience_level"] = tags["experience"]
            j["job_type"] = tags["job_type"]
            j["date_posted"] = j.get("date_posted") or datetime.datetime.now(datetime.timezone.utc).isoformat()
            j["salary_raw"] = j.get("salary_raw") or "Disclosed at ATS"
            j["verified"] = True

            existing_jobs.insert(0, j)  # Prepend newest dork-fetched jobs
            existing_urls.add(url)
            existing_keys.add(key)
            added_count += 1

        if added_count > 0:
            logger.info("Added %d new jobs from Boolean dork execution.", added_count)
            # Save to data/jobs.json
            with open(jobs_file, "w", encoding="utf-8") as f:
                json.dump(existing_jobs, f, indent=2, ensure_ascii=False)

            # Sync to web/public/data/jobs.json
            web_jobs_file = PROJECT_ROOT / "web" / "public" / "data" / "jobs.json"
            web_jobs_file.parent.mkdir(parents=True, exist_ok=True)
            with open(web_jobs_file, "w", encoding="utf-8") as f:
                json.dump(existing_jobs, f, indent=2, ensure_ascii=False)

        return added_count


def main():
    parser = argparse.ArgumentParser(description="Abstract Boolean Dork Job Fetcher")
    parser.add_argument("--query", type=str, help="Single boolean query to run (e.g. '\"devops\" \"remote\" site:boards.greenhouse.io')")
    parser.add_argument("--all", action="store_true", help="Run all queries defined in config/boolean_queries.json")
    parser.add_argument("--limit", type=int, default=25, help="Max jobs per query")
    parser.add_argument("--no-save", action="store_true", help="Dry run without updating jobs.json")

    args = parser.parse_args()
    engine = AbstractBooleanJobEngine()

    if args.query:
        jobs = engine.run_query(args.query, limit=args.limit)
    elif args.all or len(sys.argv) == 1:
        jobs = engine.run_all_configured()
    else:
        parser.print_help()
        return

    logger.info("Total jobs retrieved: %d", len(jobs))
    for i, j in enumerate(jobs[:8], 1):
        logger.info("  %d. [%s] %s @ %s (%s)", i, j.get("company"), j.get("title"), j.get("location"), j.get("apply_url"))

    if not args.no_save and jobs:
        added = engine.merge_and_save(jobs)
        logger.info("Successfully added %d new jobs to portal dataset.", added)


if __name__ == "__main__":
    main()
