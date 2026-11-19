"""50-Post Manual Audit Exporter.

Randomly samples 50 tagged posts from `data/jobs.json` and exports
`audit/sample_50.csv` with designated evaluation columns for accuracy scoring.
"""

import csv
import json
import random
from pathlib import Path


def export_audit_sample(
    jobs_path: str = "data/jobs.json",
    output_path: str = "audit/sample_50.csv",
    sample_size: int = 50,
    seed: int = 42,
) -> None:
    """Exports 50 random tagged jobs into a CSV for manual accuracy verification."""
    jobs_file = Path(jobs_path)
    if not jobs_file.exists():
        raise FileNotFoundError(f"Dataset not found at {jobs_path}. Run the pipeline first.")

    with open(jobs_file, "r", encoding="utf-8") as f:
        jobs = json.load(f)

    if len(jobs) == 0:
        raise ValueError("Job dataset is empty.")

    actual_sample_size = min(sample_size, len(jobs))
    random.seed(seed)
    sampled_jobs = random.sample(jobs, actual_sample_size)

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "id",
        "company",
        "title",
        "raw_location",
        "apply_url",
        "llm_role",
        "llm_city",
        "role_correct",
        "city_correct",
        "notes",
    ]

    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for j in sampled_jobs:
            writer.writerow({
                "id": j.get("id", ""),
                "company": j.get("company", ""),
                "title": j.get("title", ""),
                "raw_location": j.get("raw_location", ""),
                "apply_url": j.get("apply_url", ""),
                "llm_role": j.get("role", ""),
                "llm_city": j.get("city", ""),
                "role_correct": "",  # Blank for manual scoring (0 or 1)
                "city_correct": "",  # Blank for manual scoring (0 or 1)
                "notes": "",         # Blank for manual notes
            })

    print(f"Exported {actual_sample_size} audit sample posts to {out_file.resolve()}")


if __name__ == "__main__":
    export_audit_sample()
