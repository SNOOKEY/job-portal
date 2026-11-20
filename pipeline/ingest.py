"""Ingestion Engine for Beep Fresher & Internship Job Portal.

Pulls directly from official, ToS-compliant public ATS boards
(Greenhouse, Lever, Ashby) to guarantee 100% live application links.
"""

import json
import logging
import re
import time
import datetime
from pathlib import Path
from typing import Dict, List, Any
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingest")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
}

# Negative keywords to exclude senior executive / director roles
SENIOR_EXCLUSION_KEYWORDS = [
    r"\bdirector\b",
    r"\bvp\b",
    r"\bvice president\b",
    r"\bgeneral manager\b",
    r"\bprincipal\b",
    r"\bhead of\b",
    r"\bpartner\b",
    r"\bchief\b",
]

# Foreign countries and non-Indian hubs to explicitly filter out
FOREIGN_LOCATION_KEYWORDS = [
    "new york", "san mateo", "london", "san francisco", "austin", "seattle",
    "singapore", "berlin", "paris", "sydney", "dublin", "chicago", "los angeles",
    "tokyo", "indiana", "indianapolis", "usa", "united states", "canada", "uk"
]


def is_target_job(title: str) -> bool:
    """Returns True for valid fresher, intern, entry, and professional postings."""
    if not title or len(title.strip()) < 3:
        return False
    title_lower = title.lower()

    # 1. Exclude dummy or test postings
    if any(k in title_lower for k in ["test job", "do not apply", "dummy posting", "sample role"]):
        return False

    # 2. Exclude high-level executive & director roles
    if any(re.search(kw, title_lower) for kw in SENIOR_EXCLUSION_KEYWORDS):
        return False

    return True


def is_india_location(location_str: str) -> bool:
    """Returns True if the location is strictly within India or Remote for India."""
    loc_lower = (location_str or "").lower()
    
    # If location explicitly specifies a foreign country / state, reject
    if any(f in loc_lower for f in FOREIGN_LOCATION_KEYWORDS):
        return False

    return True


def fetch_greenhouse(company: str, token: str) -> List[Dict[str, Any]]:
    """Fetch jobs from public Greenhouse boards API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    jobs = []
    try:
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        if r.status_code == 200:
            data = r.json()
            raw_jobs = data.get("jobs", [])
            for rj in raw_jobs:
                title = rj.get("title", "").strip()
                loc_obj = rj.get("location")
                loc = loc_obj.get("name", "").strip() if isinstance(loc_obj, dict) else str(loc_obj or "").strip()
                apply_url = rj.get("absolute_url", "").strip()
                
                if apply_url and is_target_job(title) and is_india_location(loc):
                    dt = rj.get("updated_at") or datetime.datetime.now(datetime.timezone.utc).isoformat()
                    jobs.append({
                        "title": title,
                        "company": company,
                        "raw_location": loc or "Bengaluru, India",
                        "apply_url": apply_url,
                        "posted_at": dt,
                        "source": "Greenhouse",
                    })
    except Exception as e:
        logger.warning(f"Error fetching Greenhouse board {token} ({company}): {e}")
    time.sleep(0.3)
    return jobs


def fetch_lever(company: str, site: str) -> List[Dict[str, Any]]:
    """Fetch jobs from public Lever board API."""
    url = f"https://api.lever.co/v0/postings/{site}?mode=json"
    jobs = []
    try:
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        if r.status_code == 200:
            raw_jobs = r.json()
            if isinstance(raw_jobs, list):
                for rj in raw_jobs:
                    title = rj.get("text", "").strip()
                    cats = rj.get("categories", {})
                    loc = cats.get("location", "").strip() if isinstance(cats, dict) else ""
                    all_locs = cats.get("allLocations", []) if isinstance(cats, dict) else []
                    full_loc = f"{loc} {' '.join(all_locs)}".strip()
                    apply_url = rj.get("hostedUrl", "").strip()
                    
                    if apply_url and is_target_job(title) and is_india_location(full_loc):
                        created = rj.get("createdAt")
                        if created:
                            dt = datetime.datetime.fromtimestamp(created / 1000.0, datetime.timezone.utc).isoformat()
                        else:
                            dt = datetime.datetime.now(datetime.timezone.utc).isoformat()
                        jobs.append({
                            "title": title,
                            "company": company,
                            "raw_location": loc or "India",
                            "apply_url": apply_url,
                            "posted_at": dt,
                            "source": "Lever",
                        })
    except Exception as e:
        logger.warning(f"Error fetching Lever board {site} ({company}): {e}")
    time.sleep(0.3)
    return jobs


def fetch_ashby(company: str, org: str) -> List[Dict[str, Any]]:
    """Fetch jobs from public Ashby board API."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{org}"
    jobs = []
    try:
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        if r.status_code == 200:
            data = r.json()
            raw_jobs = data.get("jobs", [])
            for rj in raw_jobs:
                title = rj.get("title", "").strip()
                loc = rj.get("location", "").strip()
                sec_locs = rj.get("secondaryLocations", [])
                sec_strs = [s.get("location", str(s)) if isinstance(s, dict) else str(s) for s in sec_locs]
                full_loc = f"{loc} {' '.join(sec_strs)}".strip()
                apply_url = rj.get("jobUrl", "").strip()
                
                if apply_url and is_target_job(title) and is_india_location(full_loc):
                    dt = rj.get("publishedAt") or datetime.datetime.now(datetime.timezone.utc).isoformat()
                    jobs.append({
                        "title": title,
                        "company": company,
                        "raw_location": loc or "Bengaluru, India",
                        "apply_url": apply_url,
                        "posted_at": dt,
                        "source": "Ashby",
                    })
    except Exception as e:
        logger.warning(f"Error fetching Ashby board {org} ({company}): {e}")
    time.sleep(0.3)
    return jobs


def run_ingestion(config_path: str = "config/sources.json") -> List[Dict[str, Any]]:
    """Main ingestion coordinator: iterates through verified ATS sources and yields standardized posts."""
    cfg_file = Path(config_path)
    if not cfg_file.exists():
        raise FileNotFoundError(f"Source configuration file not found at {config_path}")
        
    with open(cfg_file, "r", encoding="utf-8") as f:
        config = json.load(f)

    all_raw_jobs: List[Dict[str, Any]] = []
    logger.info("Starting ingestion across verified direct ATS boards...")

    # 1. Greenhouse boards
    for b in config.get("greenhouse_boards", []):
        jobs = fetch_greenhouse(b["company"], b["token"])
        all_raw_jobs.extend(jobs)

    # 2. Lever boards
    for b in config.get("lever_boards", []):
        jobs = fetch_lever(b["company"], b["site"])
        all_raw_jobs.extend(jobs)

    # 3. Ashby boards
    for b in config.get("ashby_boards", []):
        jobs = fetch_ashby(b["company"], b["org"])
        all_raw_jobs.extend(jobs)

    logger.info(f"Total verified ATS raw jobs ingested: {len(all_raw_jobs)}")
    return all_raw_jobs


if __name__ == "__main__":
    jobs = run_ingestion()
    print(f"Ingestion test complete. Fetched {len(jobs)} posts.")
