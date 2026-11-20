"""Export the full job dataset to a spreadsheet-friendly CSV."""

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
JOBS_PATH = ROOT / "data" / "jobs.json"
OUTPUT_PATH = ROOT / "data" / "jobs_working_sheet.csv"
FORMULA_PREFIXES = ("=", "+", "-", "@")
FIELDNAMES = [
    "Company",
    "Job Title",
    "Role",
    "City",
    "Original Location",
    "Experience",
    "Job Type",
    "Posted At",
    "Source",
    "Confidence",
    "Apply URL",
    "Job ID",
]


def spreadsheet_text(value: object) -> object:
    """Keep untrusted text from being interpreted as a spreadsheet formula."""
    if not isinstance(value, str):
        return value

    if value.lstrip().startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value


def export_working_sheet(
    jobs_path: Path = JOBS_PATH,
    output_path: Path = OUTPUT_PATH,
) -> int:
    """Export all job records and return the number of rows written."""
    with jobs_path.open("r", encoding="utf-8") as jobs_file:
        jobs = json.load(jobs_file)

    if not isinstance(jobs, list):
        raise ValueError(f"Expected a list of jobs in {jobs_path}.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        for job in jobs:
            writer.writerow(
                {
                    "Company": spreadsheet_text(job.get("company", "")),
                    "Job Title": spreadsheet_text(job.get("title", "")),
                    "Role": spreadsheet_text(job.get("role", "")),
                    "City": spreadsheet_text(job.get("city", "")),
                    "Original Location": spreadsheet_text(job.get("raw_location", "")),
                    "Experience": spreadsheet_text(job.get("experience", "")),
                    "Job Type": spreadsheet_text(job.get("job_type", "")),
                    "Posted At": spreadsheet_text(job.get("posted_at", "")),
                    "Source": spreadsheet_text(job.get("source", "")),
                    "Confidence": job.get("confidence", ""),
                    "Apply URL": spreadsheet_text(job.get("apply_url", "")),
                    "Job ID": spreadsheet_text(job.get("id", "")),
                }
            )

    return len(jobs)


if __name__ == "__main__":
    row_count = export_working_sheet()
    print(f"Exported {row_count} jobs to {OUTPUT_PATH}")
