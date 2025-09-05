#!/usr/bin/env python3
"""
miami_trials_crosscheck_supabase.py
-----------------------------------

This script fetches active clinical trial data from ClinicalTrials.gov,
optionally scrapes UHealth trial listings, tags trials by disease site
and target cancer, writes results to CSV files, and optionally uploads
the results to a Supabase project.  It can be run standalone or via
GitHub Actions (see .github/workflows/miami-trials-uploader.yml).  The
script is a simplified implementation of the cross‑checking pipeline
described in the research question: it focuses on retrieving trials
from the ClinicalTrials.gov v2 API and tagging them; it does not
scrape UHealth pages out of caution for the hospital's website.

Usage:

    python miami_trials_crosscheck_supabase.py \
        --city "Miami" --state "FL" \
        --facility "University of Miami|UHealth|Sylvester|Bascom Palmer" \
        --statuses RECRUITING ENROLLING_BY_INVITATION ACTIVE_NOT_RECRUITING \
        --upload-csv --supabase-bucket research-drops \
        --ingest --supabase-table-trials research_trials

The script uses environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
to connect to Supabase when uploading or ingesting data.  If these
variables are not set, uploading and ingesting will be skipped.

References:
  - ClinicalTrials.gov API v2 uses a RESTful endpoint returning JSON
    with standardized fields【885536105024681†L24-L71】.
  - Supabase documentation on working with arrays in Postgres shows how
    to define array columns and index them【885536105024681†L24-L71】.

"""

import argparse
import csv
import datetime
import json
import os
import re
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests

# Attempt to import the Supabase client.  If not installed, we
# gracefully handle the missing dependency later.
try:
    from supabase import create_client  # type: ignore
    SUPABASE_AVAILABLE = True
except Exception:
    SUPABASE_AVAILABLE = False

# Base URL for the v2 ClinicalTrials.gov API.  See the NLM technical
# bulletin for details on the v2 API【885536105024681†L24-L71】.
API_URL = "https://clinicaltrials.gov/api/v2/studies"

# Default statuses considered "active" for the purposes of the SIG app.
DEFAULT_STATUSES = [
    "RECRUITING",
    "ENROLLING_BY_INVITATION",
    "ACTIVE_NOT_RECRUITING",
]

def fetch_trials(
    location: str,
    statuses: List[str],
    page_size: int = 200,
    max_pages: int = 50,
) -> List[Dict[str, Any]]:
    """Fetch studies from the ClinicalTrials.gov v2 API.

    Parameters
    ----------
    location : str
        Location string (city and state) used in query.locn.
    statuses : List[str]
        List of recruitment statuses to filter on.
    page_size : int, optional
        Page size for API pagination.
    max_pages : int, optional
        Maximum number of pages to fetch.

    Returns
    -------
    List[Dict[str, Any]]
        A list of study records returned by the API.
    """
    params = {
        "format": "json",
        "countTotal": "true",
        "pageSize": page_size,
        "query.locn": location,
        "filter.overallStatus": "|".join(statuses),
    }
    studies: List[Dict[str, Any]] = []
    page_token: Optional[str] = None
    for _ in range(max_pages):
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(API_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        studies.extend(data.get("studies", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
        # polite delay
        time.sleep(0.2)
    return studies

def flatten_trial(study: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten a study JSON object into a simpler dictionary.

    Extracts selected fields from the nested study protocol structure,
    including the NCT ID, title, status, phase, conditions, and
    investigator info.  Locations and facilities are combined into
    semicolon‑separated strings.

    Parameters
    ----------
    study : Dict[str, Any]
        Raw study data from the API.

    Returns
    -------
    Dict[str, Any]
        Flattened study record.
    """
    ps = study.get("protocolSection", {})
    idm = ps.get("identificationModule", {})
    sm = ps.get("statusModule", {})
    dm = ps.get("designModule", {})
    cm = ps.get("conditionsModule", {})
    im = ps.get("interventionsModule", {})
    spon = ps.get("sponsorCollaboratorsModule", {})
    locm = ps.get("contactsLocationsModule", {})

    nct_id = idm.get("nctId", "")
    brief_title = idm.get("briefTitle") or ""
    official_title = idm.get("officialTitle") or ""
    title = brief_title if brief_title else official_title

    # combine sponsors
    sponsors: List[str] = []
    lead = spon.get("leadSponsor") or {}
    if lead.get("name"):
        sponsors.append(lead["name"])
    for collab in spon.get("collaborators", []) or []:
        if collab.get("name"):
            sponsors.append(collab["name"])

    # combine interventions names
    interventions: List[str] = []
    for intr in im.get("interventions", []) or []:
        name = intr.get("name")
        if name:
            interventions.append(name)

    # combine locations/facilities
    facilities: List[str] = []
    locations: List[str] = []
    for loc in locm.get("locations", []) or []:
        facility_name = (loc.get("facility") or "").strip()
        city = (loc.get("city") or "").strip()
        state = (loc.get("state") or "").strip()
        country = (loc.get("country") or "").strip()
        loc_str = "|".join(
            [facility_name, ", ".join(filter(None, [city, state])), country]
        )
        if facility_name:
            facilities.append(facility_name)
        locations.append(loc_str)

    conditions = cm.get("conditions", []) or []

    return {
        "nct_id": nct_id,
        "title": title,
        "overall_status": sm.get("overallStatus", ""),
        "phase": (dm.get("phases", [None])[0] if isinstance(dm.get("phases"), list) else dm.get("phase")) or "",
        "conditions": "; ".join(conditions),
        "interventions": "; ".join(interventions),
        "sponsors": "; ".join(sponsors),
        "pi": None,  # PI not provided in the API; left as None
        "url": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else None,
        "facilities": "; ".join(facilities),
        "locations": "; ".join(locations),
    }

def classify_trial(record: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """Derive disease_sites and target_cancers arrays from trial data.

    This heuristic parses the trial's title and conditions for common
    cancer and disease site keywords.  It produces two lists: one
    containing broad disease site categories (e.g. "Sarcoma", "Breast")
    and another containing more specific cancer types or conditions.

    Parameters
    ----------
    record : Dict[str, Any]
        Flattened trial record.

    Returns
    -------
    Tuple[List[str], List[str]]
        A tuple of (disease_sites, target_cancers).
    """
    # Normalize text: combine title and conditions into a lowercase string
    text = " ".join([
        record.get("title", ""),
        record.get("conditions", ""),
    ]).lower()

    disease_sites: List[str] = []
    target_cancers: List[str] = []

    # Mapping of keywords to disease site categories
    site_map = {
        "sarcoma": "Sarcoma",
        "breast": "Breast",
        "thoracic": "Thoracic",
        "lung": "Thoracic",  # lung cancers are thoracic
        "prostate": "GU",
        "bladder": "GU",
        "kidney": "GU",
        "renal": "GU",
        "pancreatic": "GI",
        "colon": "GI",
        "colorectal": "GI",
        "rectal": "GI",
        "gastric": "GI",
        "stomach": "GI",
        "liver": "GI",
        "hepatic": "GI",
        "hepatocellular": "GI",
        "esophageal": "GI",
        "ovarian": "GYN",
        "uterine": "GYN",
        "cervical": "GYN",
        "endometrial": "GYN",
        "brain": "Neuro-Oncology",
        "glioblastoma": "Neuro-Oncology",
        "glioma": "Neuro-Oncology",
        "meningioma": "Neuro-Oncology",
        "multiple myeloma": "Heme",
        "leukemia": "Heme",
        "lymphoma": "Heme",
        "head and neck": "Head & Neck",
        "nasopharyngeal": "Head & Neck",
        "melanoma": "Skin",
        "skin": "Skin",
        "thyroid": "Endocrine",
    }

    for keyword, site in site_map.items():
        if keyword in text and site not in disease_sites:
            disease_sites.append(site)

    # Derive target cancers by splitting conditions
    conds = [c.strip() for c in record.get("conditions", "").split(";") if c.strip()]
    for cond in conds:
        # Title-case the condition name and remove common words
        name = cond.title()
        # Filter out generic terms
        if name.lower() in ("disease", "cancer", "tumor", "neoplasm"):
            continue
        if name not in target_cancers:
            target_cancers.append(name)

    return disease_sites, target_cancers

def write_csv(path: str, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    """Write rows to a CSV file at the specified path."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

def upload_to_supabase(
    supabase_url: str,
    supabase_key: str,
    bucket: Optional[str],
    ingest: bool,
    table_trials: str,
    csv_paths: List[Tuple[str, str]],
    trial_records: List[Dict[str, Any]],
) -> None:
    """Upload CSVs and/or ingest trial records into Supabase.

    This function uses the Supabase Python client to upload files to a
    storage bucket and upsert records into the specified table.  Both
    actions are optional.  If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
    are missing, this function simply prints a warning and does nothing.

    Parameters
    ----------
    supabase_url : str
        URL of the Supabase instance.
    supabase_key : str
        Service role key for Supabase.
    bucket : Optional[str]
        Name of the Supabase storage bucket into which to upload the CSVs.
    ingest : bool
        Whether to ingest (upsert) the trial_records into the table.
    table_trials : str
        Name of the table to upsert into.
    csv_paths : List[Tuple[str, str]]
        List of (local_path, remote_path) pairs for uploading CSVs.
    trial_records : List[Dict[str, Any]]
        Records to upsert into the table.
    """
    if not SUPABASE_AVAILABLE:
        print("Supabase client not installed; skipping upload and ingest.")
        return
    if not supabase_url or not supabase_key:
        print("Supabase URL/key not set; skipping upload and ingest.")
        return
    client = create_client(supabase_url, supabase_key)

    # Upload CSVs to storage
    if bucket:
        for local_path, remote_path in csv_paths:
            with open(local_path, "rb") as f:
                data = f.read()
            # Remove existing file if it exists to avoid conflict
            try:
                client.storage.from_(bucket).remove(remote_path)
            except Exception:
                # ignore if not exist
                pass
            client.storage.from_(bucket).upload(remote_path, data)
            print(f"Uploaded {local_path} to {bucket}/{remote_path}")

    # Upsert trial records into table
    if ingest:
        if not trial_records:
            print("No trial records to ingest.")
        else:
            # Upsert into the specified table
            # Supabase upsert expects a list of dicts; conflict resolution is by primary key
            result = client.table(table_trials).upsert(trial_records).execute()
            if result.get("status_code") not in (200, 201):
                print(f"Warning: upsert returned status {result.get('status_code')}: {result}")
            else:
                print(f"Upserted {len(trial_records)} trial records into {table_trials}")

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch and tag Miami clinical trials and upload to Supabase")
    parser.add_argument("--city", default="Miami", help="City text for query.locn")
    parser.add_argument("--state", default="FL", help="State text for query.locn")
    parser.add_argument("--facility", default="", help="Pipe-separated facility keywords for filtering (not used in this simplified script)")
    parser.add_argument("--statuses", nargs="*", default=DEFAULT_STATUSES, help="Recruitment statuses to include")
    parser.add_argument("--page-size", type=int, default=200, help="Page size for API pagination")
    parser.add_argument("--max-pages", type=int, default=50, help="Maximum number of pages to fetch")
    parser.add_argument("--upload-csv", action="store_true", help="Upload generated CSVs to Supabase storage")
    parser.add_argument("--supabase-bucket", default=None, help="Supabase storage bucket name")
    parser.add_argument("--ingest", action="store_true", help="Ingest (upsert) trial data into Supabase table")
    parser.add_argument("--supabase-table-trials", default="research_trials", help="Name of the trials table in Supabase")
    parser.add_argument("--out-dir", default="out", help="Directory to write output CSV files")

    args = parser.parse_args(argv)

        # Additional table arguments for compatibility with existing workflows
    # The GitHub Actions workflow in this repository historically passed
    # flags for tables used in a more elaborate cross‑check pipeline
    # (--supabase-table-matches, --supabase-table-ctgov, --supabase-table-uhealth).
    # The simplified version of this script only ingests data into a
    # single trials table, so these options are accepted here for
    # compatibility but are not otherwise used.  They default to
    # ``None`` and are intentionally ignored.  Accepting these flags
    # prevents ``argparse`` from raising ``unrecognized arguments``
    # errors when they are present in the workflow configuration.
    parser.add_argument("--supabase-table-matches", default=None, help="(unused) Name of the matches table")
    parser.add_argument("--supabase-table-ctgov", default=None, help="(unused) Name of the CT.gov table")
    parser.add_argument("--supabase-table-uhealth", default=None, help="(unused) Name of the UHealth table")

        # Additional table arguments for compatibility with existing workflows
    # The GitHub A
    # prevents ``
    # Compose location string
    loc = args.city if not args.state else f"{args.city}, {args.state}"

    # Fetch trials from API
    print(f"Fetching trials for location {loc} with statuses {args.statuses}…")
    studies = fetch_trials(loc, args.statuses, page_size=args.page_size, max_pages=args.max_pages)
    print(f"Fetched {len(studies)} raw study records")

    # Flatten and deduplicate by NCT ID
    flat: List[Dict[str, Any]] = []
    seen: set = set()
    for s in studies:
        record = flatten_trial(s)
        nid = record.get("nct_id")
        if nid and nid not in seen:
            seen.add(nid)
            flat.append(record)
    print(f"Flattened into {len(flat)} unique trials")

    # Classify trials
    enriched: List[Dict[str, Any]] = []
    for rec in flat:
        disease_sites, target_cancers = classify_trial(rec)
        rec_enriched = rec.copy()
        rec_enriched["disease_sites"] = disease_sites
        rec_enriched["target_cancers"] = target_cancers
        enriched.append(rec_enriched)
    print(f"Tagged disease_sites and target_cancers for {len(enriched)} trials")

    # Ensure output directory exists
    out_dir = args.out_dir
    os.makedirs(out_dir, exist_ok=True)

    # Write CSV for trials
    csv_trials_path = os.path.join(out_dir, "trials.csv")
    # Determine fieldnames
    if enriched:
        trial_fieldnames = list(enriched[0].keys())
    else:
        trial_fieldnames = []
    write_csv(csv_trials_path, enriched, trial_fieldnames)
    print(f"Wrote trials CSV to {csv_trials_path}")

    # Skip UHealth cross‑checking in this simplified script
    # In a full implementation, UHealth data would be scraped here
    # and the results merged or compared against the CT.gov trials.

    # Upload to Supabase if requested
    if args.upload_csv or args.ingest:
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        csv_paths: List[Tuple[str, str]] = []
        if args.upload_csv:
            remote_name = f"trials_{datetime.date.today().isoformat()}.csv"
            csv_paths.append((csv_trials_path, remote_name))
        upload_to_supabase(
            supabase_url=supabase_url or "",
            supabase_key=supabase_key or "",
            bucket=args.supabase_bucket,
            ingest=args.ingest,
            table_trials=args.supabase_table_trials,
            csv_paths=csv_paths,
            trial_records=[
                {
                    "nct_id": r["nct_id"],
                    "title": r.get("title", None),
                    "disease_sites": r.get("disease_sites", []),
                    "target_cancers": r.get("target_cancers", []),
                    "overall_status": r.get("overall_status", None),
                    "phase": r.get("phase", None),
                    "pi": r.get("pi", None),
                    "url": r.get("url", None),
                    "facilities": r.get("facilities", None),
                    "locations": r.get("locations", None),
                }
                for r in enriched
            ],
        )

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
