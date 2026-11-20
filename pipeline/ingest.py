"""Ingestion Engine for Beep Fresher & Internship Job Portal.

Pulls from ToS-compliant public sources (Greenhouse, Lever, Ashby, SimplifyJobs, and Arbeitnow),
normalizing all items into a single unified schema:
{title, company, raw_location, apply_url, posted_at, source}
"""

import json
import logging
import re
import time
from pathlib import Path
from typing import Dict, List, Any
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingest")

USER_AGENT = "BeepFresherJobPortal/1.0 (+https://github.com/public-job-aggregator; polite bot)"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
}

# Positive keywords for entry-level / fresher / internship
FRESHER_KEYWORDS = [
    r"\bintern\b",
    r"\binternship\b",
    r"\bfresher\b",
    r"\bgraduate\b",
    r"\bnew grad\b",
    r"\bentry[- ]level\b",
    r"\b0[- ]1\b",
    r"\btrainee\b",
    r"\bjunior\b",
    r"\bassociate\b",
    r"\banalyst\b",
    r"\bexecutive\b",
    r"\bapprentice\b",
    r"\bcampus\b",
]

# Negative keywords to exclude senior / managerial roles
SENIOR_EXCLUSION_KEYWORDS = [
    r"\bdirector\b",
    r"\bvp\b",
    r"\bvice president\b",
    r"\bmanager\b",
    r"\blead\b",
    r"\bprincipal\b",
    r"\bstaff\b",
    r"\barchitect\b",
    r"\bhead of\b",
    r"\bpartner\b",
    r"\bsenior\b",
    r"\bsr\.\b",
]

# Foreign countries and non-Indian hubs to explicitly filter out
FOREIGN_LOCATION_KEYWORDS = [
    r"\bindiana\b", r"\bindianapolis\b", r"\busa\b", r"\bunited states\b",
    r"\bcalifornia\b", r"\btexas\b", r"\bnew york\b", r"\bflorida\b",
    r"\bohio\b", r"\bcanada\b", r"\buk\b", r"\blondon\b", r"\bgermany\b",
    r"\bfrance\b", r"\baustralia\b", r"\bsingapore\b", r"\bnetherlands\b",
    r"\bireland\b", r"\bpoland\b", r"\bspain\b", r"\bemea\b", r"\blatam\b",
    r"\bapac\b", r"\bjapan\b", r"\btokyo\b", r"\bnew mexico\b", r"\bmichigan\b"
]

# Indian cities and recognized hubs
INDIA_LOCATION_KEYWORDS = [
    r"\bindia\b",
    r"\bbengaluru\b",
    r"\bbangalore\b",
    r"\bdelhi\b",
    r"\bnew delhi\b",
    r"\bgurgaon\b",
    r"\bgurugram\b",
    r"\bnoida\b",
    r"\bgreater noida\b",
    r"\bfaridabad\b",
    r"\bghaziabad\b",
    r"\bmumbai\b",
    r"\bnavi mumbai\b",
    r"\bthane\b",
    r"\bhyderabad\b",
    r"\bsecunderabad\b",
    r"\bpune\b",
    r"\bchennai\b",
    r"\bkolkata\b",
    r"\bahmedabad\b",
    r"\bgandhinagar\b",
    r"\bjaipur\b",
    r"\bkochi\b",
    r"\bcochin\b",
    r"\bchandigarh\b",
    r"\bindore\b",
    r"\bcoimbatore\b",
    r"\bpan-india\b",
    r"\bremote - india\b",
    r"\bindia remote\b",
    r"\bremote, india\b",
    r"\bremote \(india\)\b",
]


def is_target_job(title: str, is_curated_fresher_source: bool = False) -> bool:
    """Returns True for fresher, intern, entry-level, junior postings."""
    if not title or len(title.strip()) < 3:
        return False
    title_lower = title.lower()

    # 1. Exclude dummy or test postings
    if any(k in title_lower for k in ["test job", "do not apply", "dummy posting", "sample role"]):
        return False

    # 2. Exclude senior / managerial roles
    if any(re.search(kw, title_lower) for kw in SENIOR_EXCLUSION_KEYWORDS):
        return False

    # 3. For curated fresher feeds, accept unless excluded by senior rule
    if is_curated_fresher_source:
        return True

    # 4. For generic ATS boards, require positive fresher/intern keyword
    return any(re.search(kw, title_lower) for kw in FRESHER_KEYWORDS)


def is_india_location(location_str: str) -> bool:
    """Returns True if the location is strictly within India or Remote for India."""
    loc_lower = location_str.lower()
    
    # If location explicitly specifies a foreign country / state, reject unless India is also explicitly mentioned
    if any(re.search(f, loc_lower) for f in FOREIGN_LOCATION_KEYWORDS) and "india" not in loc_lower:
        return False

    return any(re.search(k, loc_lower) for k in INDIA_LOCATION_KEYWORDS)


def fetch_greenhouse(company: str, token: str) -> List[Dict[str, Any]]:
    """Fetch jobs from public Greenhouse boards API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    jobs = []
    try:
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=8)
        if r.status_code == 200:
            data = r.json()
            raw_jobs = data.get("jobs", [])
            for rj in raw_jobs:
                title = rj.get("title", "").strip()
                loc_obj = rj.get("location")
                loc = loc_obj.get("name", "").strip() if isinstance(loc_obj, dict) else str(loc_obj or "").strip()
                
                if is_target_job(title) and (is_india_location(loc) or "india" in title.lower()):
                    jobs.append({
                        "title": title,
                        "company": company,
                        "raw_location": loc or "India (Flexible)",
                        "apply_url": rj.get("absolute_url", ""),
                        "posted_at": rj.get("updated_at") or "",
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
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=8)
        if r.status_code == 200:
            raw_jobs = r.json()
            if isinstance(raw_jobs, list):
                for rj in raw_jobs:
                    title = rj.get("text", "").strip()
                    cats = rj.get("categories", {})
                    loc = cats.get("location", "").strip() if isinstance(cats, dict) else ""
                    all_locs = cats.get("allLocations", []) if isinstance(cats, dict) else []
                    full_loc = f"{loc} {' '.join(all_locs)}".strip()
                    
                    if is_target_job(title) and (is_india_location(full_loc) or "india" in title.lower()):
                        jobs.append({
                            "title": title,
                            "company": company,
                            "raw_location": loc or "India",
                            "apply_url": rj.get("hostedUrl", ""),
                            "posted_at": str(rj.get("createdAt", "")),
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
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=8)
        if r.status_code == 200:
            data = r.json()
            raw_jobs = data.get("jobs", [])
            for rj in raw_jobs:
                title = rj.get("title", "").strip()
                loc = rj.get("location", "").strip()
                sec_locs = rj.get("secondaryLocations", [])
                sec_strs = [s.get("location", str(s)) if isinstance(s, dict) else str(s) for s in sec_locs]
                full_loc = f"{loc} {' '.join(sec_strs)}".strip()
                
                if is_target_job(title) and (is_india_location(full_loc) or "india" in title.lower()):
                    jobs.append({
                        "title": title,
                        "company": company,
                        "raw_location": loc or "India",
                        "apply_url": rj.get("jobUrl", ""),
                        "posted_at": rj.get("publishedAt", ""),
                        "source": "Ashby",
                    })
    except Exception as e:
        logger.warning(f"Error fetching Ashby board {org} ({company}): {e}")
    time.sleep(0.3)
    return jobs


def fetch_simplify_jobs(feed_url: str) -> List[Dict[str, Any]]:
    """Fetch Indian fresher/intern postings from SimplifyJobs public feeds."""
    jobs = []
    try:
        r = requests.get(feed_url, headers=REQUEST_HEADERS, timeout=10)
        if r.status_code == 200:
            items = r.json()
            for it in items:
                title = it.get("title", "").strip()
                company = it.get("company_name", "").strip()
                locations = it.get("locations", [])
                loc_str = ", ".join(locations) if isinstance(locations, list) else str(locations)
                
                # Check India location and fresher keywords
                if not is_india_location(loc_str):
                    continue
                if not is_target_job(title, is_curated_fresher_source=True):
                    continue

                apply_url = it.get("url", "").strip()
                if not apply_url:
                    continue

                jobs.append({
                    "title": title,
                    "company": company,
                    "raw_location": loc_str or "India",
                    "apply_url": apply_url,
                    "posted_at": str(it.get("date_posted", "")),
                    "source": "SimplifyJobs",
                })
    except Exception as e:
        logger.warning(f"Error fetching SimplifyJobs feed ({feed_url}): {e}")
    return jobs


def fetch_arbeitnow(api_url: str) -> List[Dict[str, Any]]:
    """Fetch Indian fresher/intern postings from Arbeitnow public job board API."""
    jobs = []
    try:
        r = requests.get(api_url, headers=REQUEST_HEADERS, timeout=10)
        if r.status_code == 200:
            data = r.json()
            for it in data.get("data", []):
                title = it.get("title", "").strip()
                company = it.get("company_name", "").strip()
                location = it.get("location", "").strip()
                
                if not is_india_location(location):
                    continue
                if not is_target_job(title):
                    continue

                apply_url = it.get("url", "").strip()
                if not apply_url:
                    continue

                jobs.append({
                    "title": title,
                    "company": company,
                    "raw_location": location or "India",
                    "apply_url": apply_url,
                    "posted_at": str(it.get("created_at", "")),
                    "source": "Arbeitnow",
                })
    except Exception as e:
        logger.warning(f"Error fetching Arbeitnow feed ({api_url}): {e}")
    return jobs


def run_ingestion(config_path: str = "config/sources.json") -> List[Dict[str, Any]]:
    """Main ingestion coordinator: iterates through configured sources and yields standardized posts."""
    cfg_file = Path(config_path)
    if not cfg_file.exists():
        raise FileNotFoundError(f"Source configuration file not found at {config_path}")
        
    with open(cfg_file, "r", encoding="utf-8") as f:
        config = json.load(f)

    all_raw_jobs: List[Dict[str, Any]] = []
    logger.info("Starting ingestion across configured ATS boards and public APIs...")

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

    # 4. Public feeds
    for feed in config.get("public_feeds", []):
        feed_type = feed.get("type")
        feed_url = feed.get("url")
        if feed_type == "simplify_json":
            jobs = fetch_simplify_jobs(feed_url)
            all_raw_jobs.extend(jobs)
        elif feed_type == "arbeitnow_api":
            jobs = fetch_arbeitnow(feed_url)
            all_raw_jobs.extend(jobs)

    logger.info(f"Total raw jobs ingested before deduplication: {len(all_raw_jobs)}")
    return all_raw_jobs


if __name__ == "__main__":
    jobs = run_ingestion()
    print(f"Ingestion test complete. Fetched {len(jobs)} posts.")
