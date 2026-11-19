"""Tagging Configuration & Taxonomies for Gemini 2.5 Flash Job Extraction.

Centralized configuration for taxonomy, normalization, prompt templates,
and pricing constants. Easily editable during live reviews or audits.
"""

from typing import List, Dict

# Allowed Primary Roles (Fixed Taxonomy)
ROLE_TAXONOMY: List[str] = [
    "Software Engineering",
    "Data & Analytics",
    "AI / ML",
    "Product",
    "Design",
    "DevOps / Cloud",
    "QA / Testing",
    "Marketing & Growth",
    "Sales & BD",
    "Operations & HR",
    "Other",
]

# Standard Normalized Indian Metro / Tier-1 Hubs
NORMALIZED_CITIES: List[str] = [
    "Bengaluru",
    "Delhi NCR",
    "Mumbai",
    "Hyderabad",
    "Pune",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Remote (India)",
    "Other",
]

# Experience Levels
EXPERIENCE_LEVELS: List[str] = [
    "Internship",
    "Fresher",
    "Mid-Level",
    "Senior",
]

# Canonical city alias mapping table
CITY_MAPPING_RULES: Dict[str, str] = {
    # Bengaluru
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "blr": "Bengaluru",
    
    # Delhi NCR
    "delhi": "Delhi NCR",
    "new delhi": "Delhi NCR",
    "gurgaon": "Delhi NCR",
    "gurugram": "Delhi NCR",
    "noida": "Delhi NCR",
    "greater noida": "Delhi NCR",
    "faridabad": "Delhi NCR",
    "ghaziabad": "Delhi NCR",
    "ncr": "Delhi NCR",

    # Mumbai
    "mumbai": "Mumbai",
    "navi mumbai": "Mumbai",
    "thane": "Mumbai",
    "bombay": "Mumbai",

    # Hyderabad
    "hyderabad": "Hyderabad",
    "secunderabad": "Hyderabad",
    "hyd": "Hyderabad",

    # Pune
    "pune": "Pune",

    # Chennai
    "chennai": "Chennai",
    "madras": "Chennai",

    # Kolkata
    "kolkata": "Kolkata",
    "calcutta": "Kolkata",

    # Ahmedabad
    "ahmedabad": "Ahmedabad",
    "gandhinagar": "Ahmedabad",

    # Remote
    "remote": "Remote (India)",
    "remote - india": "Remote (India)",
    "india remote": "Remote (India)",
    "work from home": "Remote (India)",
    "anywhere": "Remote (India)",
}

# API Pricing Reference (gemini-2.5-flash as per PRD)
# $0.30 per 1M input tokens, $2.50 per 1M output tokens
GEMINI_FLASH_INPUT_PRICE_PER_1M = 0.30
GEMINI_FLASH_OUTPUT_PRICE_PER_1M = 2.50
USD_TO_INR_EXCHANGE_RATE = 86.50

# System instruction for Gemini structured tagging
SYSTEM_PROMPT = """You are an expert technical recruiter and job categorization engine for Indian tech jobs.
Given a job posting title, company name, raw location, and excerpt, classify:
1. `role`: Exactly ONE from the allowed list:
   - "Software Engineering" (frontend, backend, full stack, mobile, systems, general SWE)
   - "Data & Analytics" (data analyst, business analyst, data engineer, BI)
   - "AI / ML" (machine learning, data scientist, NLP, computer vision, GenAI)
   - "Product" (APM, product analyst, product manager)
   - "Design" (UI/UX, product design, graphic design)
   - "DevOps / Cloud" (SRE, platform engineer, cloud architect, infrastructure)
   - "QA / Testing" (SDET, QA engineer, manual testing)
   - "Marketing & Growth" (content, SEO, growth, performance marketing)
   - "Sales & BD" (inside sales, SDR, business development, client relations)
   - "Operations & HR" (people ops, recruiter, customer support, operations)
   - "Other"

2. `city`: Normalize to one of:
   - "Bengaluru" (Bangalore)
   - "Delhi NCR" (Delhi, Gurgaon, Gurugram, Noida, Greater Noida, Faridabad)
   - "Mumbai" (Mumbai, Navi Mumbai, Thane)
   - "Hyderabad"
   - "Pune"
   - "Chennai"
   - "Kolkata"
   - "Ahmedabad"
   - "Remote (India)" (if remote or open anywhere across India)
   - "Other" (if an Indian city outside these major hubs)

3. `experience`: Exactly ONE from:
   - "Internship" (if intern, trainee, co-op, or student role)
   - "Fresher" (0–1 YoE, entry level, new graduate, junior, associate)
   - "Mid-Level" (2–5 YoE, SDE II, intermediate, professional)
   - "Senior" (5+ YoE, senior, lead, staff, principal, architect, manager, director)

4. `job_type`:
   - "Internship" (if intern or student role)
   - "Full-Time Fresher" (if entry full-time)
   - "Full-Time" (if mid or senior)

5. `confidence`: A float between 0.0 and 1.0 indicating classification confidence.
"""
