"""Deduplication Engine for Beep Job Portal.

Normalizes job entities and performs deterministic SHA-256 fingerprinting
to remove redundant postings across feeds before calling the LLM tagger.
"""

import hashlib
import re
from typing import Dict, List, Tuple, Any
import logging

logger = logging.getLogger("dedup")


def normalize_text(text: str) -> str:
    """Normalize text by converting to lowercase, removing non-alphanumeric chars and extra whitespace."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_url(url: str) -> str:
    """Strip tracking query parameters (utm_*, ref, etc.) and trailing slashes."""
    if not url:
        return ""
    # Remove query string parameters often used for tracking
    base_url = url.split("?")[0].split("#")[0].rstrip("/")
    return base_url.lower()


def compute_job_hash(company: str, title: str, location: str) -> str:
    """Computes deterministic SHA-256 fingerprint from normalized fields."""
    norm_c = normalize_text(company)
    norm_t = normalize_text(title)
    norm_l = normalize_text(location)
    key = f"{norm_c}|{norm_t}|{norm_l}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def deduplicate_jobs(raw_jobs: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """Deduplicates raw postings using SHA-256 hash and canonical apply URLs.

    Returns:
        (unique_jobs_list, stats_dictionary)
    """
    seen_hashes = set()
    seen_urls = set()
    unique_jobs: List[Dict[str, Any]] = []

    duplicates_removed = 0

    for job in raw_jobs:
        company = job.get("company", "")
        title = job.get("title", "")
        location = job.get("raw_location", "")
        apply_url = job.get("apply_url", "")

        job_hash = compute_job_hash(company, title, location)
        norm_url = normalize_url(apply_url)

        # Check duplicate conditions
        if job_hash in seen_hashes or (norm_url and norm_url in seen_urls):
            duplicates_removed += 1
            continue

        seen_hashes.add(job_hash)
        if norm_url:
            seen_urls.add(norm_url)

        # Assign immutable fingerprint id
        job_copy = dict(job)
        job_copy["id"] = f"job-{job_hash}"
        unique_jobs.append(job_copy)

    stats = {
        "raw_fetched": len(raw_jobs),
        "duplicates_removed": duplicates_removed,
        "unique_posts": len(unique_jobs),
    }

    logger.info(
        f"Deduplication complete: {stats['raw_fetched']} raw fetched -> "
        f"{stats['duplicates_removed']} duplicates removed -> "
        f"{stats['unique_posts']} unique posts remaining."
    )

    return unique_jobs, stats


if __name__ == "__main__":
    sample = [
        {"company": "Razorpay", "title": "Frontend Intern", "raw_location": "Bengaluru", "apply_url": "https://razorpay.com/jobs/1?ref=test"},
        {"company": "Razorpay ", "title": "frontend intern", "raw_location": "bengaluru", "apply_url": "https://razorpay.com/jobs/1"},
        {"company": "InMobi", "title": "Data Analyst Intern", "raw_location": "Bangalore", "apply_url": "https://inmobi.com/jobs/2"},
    ]
    unique, stats = deduplicate_jobs(sample)
    print("Unique count:", len(unique))
    print("Stats:", stats)
