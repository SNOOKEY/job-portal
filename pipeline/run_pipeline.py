"""Pipeline Orchestrator for Beep Fresher & Internship Job Portal.

Coordinates:
1. Multi-source Ingestion (Public ATS boards + APIs)
2. SHA-256 Deduplication
3. Gemini 2.5 Flash Tagging & Cost Tracking
4. Writing artifacts to `data/jobs.json` & `data/metrics.json`
"""

import datetime
import json
import logging
from pathlib import Path
from collections import Counter
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.ingest import run_ingestion
from pipeline.dedup import deduplicate_jobs
from pipeline.tagger import tag_all_jobs
from config.tagging_config import ROLE_TAXONOMY, NORMALIZED_CITIES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("orchestrator")


def execute_pipeline() -> None:
    """Executes the complete pipeline end-to-end and saves data artifacts."""
    start_time = datetime.datetime.now(datetime.timezone.utc)
    logger.info("=== Starting Beep Job Portal Refresh Pipeline ===")

    # Step 1: Ingest
    raw_posts = run_ingestion()
    raw_count = len(raw_posts)
    logger.info(f"Step 1 Complete: Ingested {raw_count} raw posts.")

    # Step 2: Deduplicate
    unique_posts, dedup_stats = deduplicate_jobs(raw_posts)
    unique_count = len(unique_posts)
    logger.info(
        f"Step 2 Complete: Removed {dedup_stats['duplicates_removed']} duplicates. "
        f"{unique_count} unique posts remain."
    )

    # Step 3: LLM Tagging & Token Cost Calculation
    tagged_posts, cost_metrics = tag_all_jobs(unique_posts)
    logger.info(f"Step 3 Complete: Tagged {len(tagged_posts)} posts.")

    # Step 4: Distributions & Aggregations
    roles_counter = Counter(p.get("role", "Other") for p in tagged_posts)
    cities_counter = Counter(p.get("city", "Other") for p in tagged_posts)
    types_counter = Counter(p.get("job_type", "Other") for p in tagged_posts)
    sources_counter = Counter(p.get("source", "Unknown") for p in tagged_posts)

    end_time = datetime.datetime.now(datetime.timezone.utc)
    duration_seconds = round((end_time - start_time).total_seconds(), 2)

    full_metrics = {
        "timestamp": end_time.isoformat(),
        "duration_seconds": duration_seconds,
        "pipeline_status": "success",
        "counts": {
            "raw_fetched": raw_count,
            "duplicates_removed": dedup_stats["duplicates_removed"],
            "unique_active_jobs": len(tagged_posts),
        },
        "cost_and_tokens": cost_metrics,
        "distributions": {
            "by_role": dict(roles_counter.most_common()),
            "by_city": dict(cities_counter.most_common()),
            "by_job_type": dict(types_counter.most_common()),
            "by_source": dict(sources_counter.most_common()),
        },
    }

    # Step 5: Save files to data/ directory
    data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)

    jobs_path = data_dir / "jobs.json"
    metrics_path = data_dir / "metrics.json"

    with open(jobs_path, "w", encoding="utf-8") as f:
        json.dump(tagged_posts, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(tagged_posts)} jobs to {jobs_path}")

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(full_metrics, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved metrics to {metrics_path}")

    # Summary Output
    print("\n" + "=" * 60)
    print(" BEEP FRESHER JOB PORTAL - PIPELINE EXECUTION SUMMARY")
    print("=" * 60)
    print(f"Total Unique Posts Live : {len(tagged_posts)}")
    print(f"Raw Posts Ingested      : {raw_count}")
    print(f"Duplicates Removed      : {dedup_stats['duplicates_removed']}")
    print(f"Execution Duration      : {duration_seconds}s")
    print("-" * 60)
    print(f"Tagging Mode            : {cost_metrics['tagging_mode']}")
    print(f"Total Tokens (In / Out) : {cost_metrics['input_tokens']} / {cost_metrics['output_tokens']}")
    print(f"Run Cost                : ${cost_metrics['run_cost_usd']} (₹{cost_metrics['run_cost_inr']})")
    print(f"Projected Cost / 1k     : ${cost_metrics['projected_cost_per_1000_posts_usd']} (₹{cost_metrics['projected_cost_per_1000_posts_inr']})")
    print("-" * 60)
    print("Top Roles:")
    for role, cnt in roles_counter.most_common(5):
        print(f"  * {role:25}: {cnt}")
    print("Top Cities:")
    for city, cnt in cities_counter.most_common(5):
        print(f"  * {city:25}: {cnt}")
    print("=" * 60 + "\n")

    # Verification as mandated by PRD
    if len(tagged_posts) < 200:
        logger.warning(
            f"Target was 200+ posts, got {len(tagged_posts)}. Check source health."
        )
    else:
        logger.info(f"Target of 200+ posts ACHIEVED! ({len(tagged_posts)} posts)")


if __name__ == "__main__":
    execute_pipeline()
