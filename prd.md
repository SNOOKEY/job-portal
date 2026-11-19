# PRD: Beep Fresher & Internship Job Portal (Gen AI MVP)

## 1. Objective
Build and deploy a **live, auto-refreshing web portal** that aggregates **200+ real fresher jobs and internships in India** from ToS-compliant public sources, deduplicates them, tags each post by **`role`** and **`city`** using **Google Gemini**, and displays them in a fast, searchable dashboard inspired by **Weekday AI's UI**.

The system must run **daily on its own** via GitHub Actions and be hosted publicly on **GitHub Pages**, with built-in **token/cost tracking** (cost per 1,000 posts) and a **50-post audit exporter** for manual accuracy verification.

---

## 2. Open-Source Reference Repos & How to Use Them
Inspect and adapt the architectural patterns from these two open-source repositories. **Do NOT copy personal job-hunting, resume-tailoring, cover-letter, or outreach bloat**—this is a public job portal, not a single-user job hunter.

1. **`career-ops`** — `https://github.com/career-ops-hq/career-ops` (MIT License)
   * **What to borrow:** The multi-portal job board scanning pattern (`scan` workflow), ATS board URL discovery/ingestion logic (Greenhouse, Lever, Ashby public boards), and posting-legitimacy heuristics (filtering out stale/closed listings).
   * **What to strip:** Personal CV matching, 1–5 fit scoring, PDF resume generation, and personal application tracking.

2. **`dossier`** — `https://github.com/AienTech/dossier` (AGPL-3.0 License)
   * **What to borrow:** Polite crawling patterns (strict `robots.txt` compliance), scheduled daily job-agent execution flow, structured job-posting extraction, and clean dashboard/table state management.
   * **What to strip:** Single-user authentication, PostgreSQL/Docker server overhead, Gmail reply drafting, and tailored resume/cover-letter generation.
   * **License Note:** If reusing code directly from `dossier`, retain AGPL-3.0 attribution in the repo; if only adopting the architectural pattern from scratch, note inspiration in the README.

---

## 3. Tech Stack & Architecture
* **Pipeline Language:** Python 3.11+
* **LLM:** Google Gemini (`gemini-2.5-flash` via `google-genai` SDK) with **Structured Outputs** (JSON Schema) for deterministic `role` and `city` tagging.
  * *Reference API Pricing (for cost calculator):* `gemini-2.5-flash` = **$0.30 / 1M input tokens**, **$2.50 / 1M output tokens** (optional ultra-low-cost alternative: `gemini-2.5-flash-lite` = **$0.10 / 1M input**, **$0.40 / 1M output**).
* **Data Store:** Static JSON (`data/jobs.json`) + metadata (`data/metrics.json`) committed to the repo.
* **Frontend:** Vite + React + Tailwind CSS (reading `data/jobs.json` and `data/metrics.json` client-side).
* **Automation & Hosting:** **GitHub Actions** (daily cron at 06:00 IST / `30 0 * * *` UTC) -> runs Python pipeline -> commits updated JSON -> builds and deploys static bundle to **GitHub Pages**.

---

## 4. Functional Requirements

### 4.1 Ingestion (200+ Real Indian Fresher/Intern Posts)
* Pull from **ToS-compliant public JSON APIs and public ATS boards** (no anti-bot bypasses or scraping sites that forbid it):
  * Public Greenhouse (`boards-api.greenhouse.io/v1/boards/{company}/jobs`), Lever (`api.lever.co/v0/postings/{company}`), and Ashby public boards for Indian tech/product companies (e.g., Razorpay, Swiggy, Zomato, PhonePe, CRED, BrowserStack, Postman, Chargebee, Groww, Zepto, Meesho, etc.).
  * Public job APIs/RSS feeds (e.g., Arbeitnow, Remotive, or Adzuna free public APIs if needed) filtered for **India** + **Fresher / Intern / 0–1 YoE / New Grad / Entry Level**.
* **Filter Rules:** Keep only roles located in India (or Remote - India) matching fresher/internship keywords (`intern`, `fresher`, `graduate`, `entry`, `0-1`, `trainee`, `junior`, `associate`).
* Target **250–400 raw posts** so that after deduplication, **200+ unique active posts** remain live.

### 4.2 Deduplication Engine
* Run **before** calling Gemini (saves API tokens).
* Normalize `company_name`, `job_title`, and `raw_location` (lowercase, strip punctuation/extra spaces).
* Generate a deterministic `SHA-256` hash of `normalized_company + normalized_title + normalized_location` (and also deduplicate by canonical `apply_url`).
* Log exact counts: `raw_fetched`, `duplicates_removed`, `unique_posts`.

### 4.3 Gemini LLM Tagging & Cost Tracker
* **Centralized Config (Critical for Live-Edit Interview):**
  * Put the allowed `ROLE_TAXONOMY` (e.g., `Software Engineering`, `Data & Analytics`, `AI / ML`, `Product`, `Design`, `DevOps / Cloud`, `Marketing & Growth`, `Sales & BD`, `Operations`, `Other`), `CITY_NORMALIZATION` rules (e.g., `Bengaluru` <- Bangalore, `Delhi NCR` <- Gurgaon/Noida/Gurugram, `Remote (India)`), and the **exact system prompt** in `config/tagging_config.py`.
* **Batching & Schema:** Send posts to `gemini-2.5-flash` using Structured Outputs returning:
  ```json
  {
    "role": "Software Engineering",
    "city": "Bengaluru",
    "job_type": "Internship | Full-Time Fresher",
    "confidence": 0.95
  }
  ```
* **Cost Tracking:** Capture `usage_metadata.prompt_token_count` and `usage_metadata.candidates_token_count` for every API call. Compute and save to `data/metrics.json`:
  * Total input tokens, total output tokens
  * Actual run cost (USD & INR)
  * **Projected Cost per 1,000 Posts**

### 4.4 50-Post Manual Audit Exporter
* Include a script `scripts/export_audit.py` that randomly samples **50 tagged posts** from `data/jobs.json` and exports `audit/sample_50.csv` with columns:
  `id, company, title, raw_location, apply_url, llm_role, llm_city, role_correct, city_correct, notes`
  (Leave the last 3 columns blank for manual 0/1 scoring).

### 4.5 Weekday AI-Inspired Dashboard UI
Design a clean, modern, high-signal SaaS job board inspired by **Weekday AI**:
* **Visual Style:** Crisp white/off-white background (`#F9FAFB`), subtle borders (`#E5E7EB`), dark slate typography, accent indigo/blue badges, generous spacing, zero clutter.
* **Top Header:** Portal title, live **"Last Refreshed: [Timestamp]"** badge, total active jobs counter, and a small link to the GitHub Repo / Architecture metrics.
* **Filter Bar (Sticky):**
  * Instant keyword search (searches title, company, role, city).
  * Multi-select or dropdown filters: **Role**, **City**, **Type (Intern / Fresher)**.
  * "Clear Filters" button + live result count.
* **Job Cards / Hybrid List:** Each card displays:
  * Company avatar/initials + Company Name + Source badge (e.g., `Greenhouse`, `Lever`).
  * Job Title (bold).
  * Clean pills for **LLM-tagged `Role`**, **LLM-tagged `City`**, and **Intern / Fresher**.
  * Posted date + prominent **"Apply ->"** button opening `apply_url` in a new tab.
* **Responsive:** Must work cleanly on both desktop and mobile.

---

## 5. Repository Structure
```text
beep-fresher-jobs/
├── .github/workflows/
│   └── daily-refresh.yml       # Cron + build + deploy to GitHub Pages
├── config/
│   ├── sources.json            # List of public ATS boards / APIs
│   └── tagging_config.py       # Role taxonomy, city rules, Gemini prompt (easy live edits)
├── pipeline/
│   ├── ingest.py               # Polite fetcher (career-ops + dossier patterns)
│   ├── dedup.py                # SHA-256 deduplication
│   ├── tagger.py               # Gemini 2.5 Flash structured tagger + token/cost tracker
│   └── run_pipeline.py         # Orchestrator -> writes data/jobs.json & data/metrics.json
├── scripts/
│   └── export_audit.py         # Exports 50 random posts to audit/sample_50.csv
├── data/
│   ├── jobs.json               # Live dataset served to frontend
│   └── metrics.json            # Pipeline stats + cost per 1,000 posts
├── web/                        # Vite + React + Tailwind (Weekday-inspired UI)
├── requirements.txt
└── README.md                   # Architecture, cost math, accuracy report, setup
```

---

## 6. Setup & Execution Instructions for Antigravity

Execute in this exact order:

1. **Initialize the repo** with the directory structure above and install Python dependencies (`google-genai`, `requests`, `pydantic`, `python-dotenv`) and frontend dependencies (`vite`, `react`, `tailwindcss`).
2. **Build `pipeline/ingest.py` + `config/sources.json`**: Populate `sources.json` with 40–60 Indian tech/startup public Greenhouse, Lever, and Ashby boards + public APIs so a single run reliably yields **200+ unique Indian fresher/intern posts**. Respect `robots.txt` and add polite rate limiting (`0.5s` delay + User-Agent header).
3. **Build `pipeline/dedup.py` and `pipeline/tagger.py`**: Implement Gemini `gemini-2.5-flash` structured tagging using `GEMINI_API_KEY` from `.env`, with retry/backoff on rate limits and exact token/cost logging to `data/metrics.json`.
4. **Run the pipeline locally** (`python pipeline/run_pipeline.py`) and verify:
   * `data/jobs.json` has **200+ unique posts**.
   * Every post has valid `role` and `city` tags.
   * `data/metrics.json` reports exact cost per 1,000 posts.
5. **Run `python scripts/export_audit.py`** to generate `audit/sample_50.csv`.
6. **Build the Weekday-inspired UI in `web/`** reading `data/jobs.json` and `data/metrics.json`, and verify search + Role/City filters locally (`npm run dev`).
7. **Create `.github/workflows/daily-refresh.yml`** to:
   * Trigger on `schedule: - cron: '30 0 * * *'` and `workflow_dispatch` (manual trigger).
   * Run `python pipeline/run_pipeline.py` using `${{ secrets.GEMINI_API_KEY }}`.
   * Commit updated `data/jobs.json` and `data/metrics.json`.
   * Build `web/` and deploy to **GitHub Pages** (`actions/deploy-pages`).

---

## 7. Manual Steps After Antigravity Finishes
1. Push the repo to GitHub (make it **Public**).
2. Go to **Settings -> Secrets and variables -> Actions** -> add `GEMINI_API_KEY`.
3. Go to **Settings -> Pages** -> set Source to **GitHub Actions**.
4. Trigger the workflow once manually via the **Actions** tab to verify the live URL works.
5. Open `audit/sample_50.csv`, hand-check all 50 rows, compute your accuracy %, and copy the prompts + audit into your Google Sheet/Doc.

---

## 8. Lean MVP Execution Plan: 5–8 Core Sources & Delta Caching

* **Bullet 1: Ingestion Consolidation (5–8 High-Yield Sources)**
  Streamline `config/sources.json` and `pipeline/ingest.py` to 5–8 reliable, fast sources (SimplifyJobs India Internships, SimplifyJobs India New Grad, Greenhouse InMobi, Greenhouse Razorpay, Lever Paytm, Lever Meesho, Ashby Headout, Ashby Snowflake). Normalize all items into a single unified schema: `{title, company, raw_location, apply_url, posted_at, source}`.

* **Bullet 2: Pre-LLM SHA-256 Deduplication**
  Compute deterministic SHA-256 hashes (`normalized_company + normalized_title + normalized_location`) and deduplicate canonical apply URLs before calling the LLM, ensuring 200+ unique Indian fresher/internship posts remain live.

* **Bullet 3: Free-Tier Gemini 2.5 Flash Tagging with Delta Caching**
  Implement `pipeline/tagger.py` with `gemini-2.5-flash` using `google-genai` SDK with thinking disabled (`thinking_budget=0`). Batch in chunks of 25–30 posts with a polite 5-second delay between calls. Use delta caching against existing `data/jobs.json` so only newly seen jobs are sent to Gemini, saving free-tier quota and logging exact token metrics and projected PAYG cost per 1,000 posts.

* **Bullet 4: 50-Post Quality Audit & Weekday AI Dashboard**
  Sample 50 random tagged jobs into `audit/sample_50.csv` for 0/1 manual scoring. Ensure `web/` renders a fast, responsive Weekday AI-inspired dashboard reading static `data/jobs.json` and `data/metrics.json` with instant search, role/city/type filtering, and last-refreshed timestamps.

* **Bullet 5: Daily CI/CD & GitHub Pages Deployment**
  Maintain `.github/workflows/daily-refresh.yml` running daily at 06:00 IST via cron and manual dispatch, using secrets.GEMINI_API_KEY, committing data updates, and deploying static assets to GitHub Pages.