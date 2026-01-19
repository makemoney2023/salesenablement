#!/usr/bin/env python3
"""
SuperPatch Canadian Campaign Caller

Makes personalized outbound calls using scraped practitioner data.
Jennifer will know the practice name, address, rating, and can reference this context.

Usage:
    # Single call with practice context
    python3 make_campaign_calls.py --phone "+16475551234" --practice-name "Toronto Wellness Clinic" --address "123 Main St"
    
    # Call from CSV file (one row at a time, with delays)
    python3 make_campaign_calls.py --csv canadian_practitioners/all_practitioners_latest.csv --limit 10
    
    # Call specific practitioner types
    python3 make_campaign_calls.py --csv canadian_practitioners/all_practitioners_latest.csv --type chiropractor --limit 5
    
    # Dry run (show what would be called)
    python3 make_campaign_calls.py --csv canadian_practitioners/all_practitioners_latest.csv --dry-run
"""

import argparse
import csv
import json
import subprocess
import time
import os
from datetime import datetime
from typing import Optional

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255"

PATHWAYS = {
    "chiropractor": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "massage therapist": "d202aad7-bcb6-478c-a211-b00877545e05",
    "massage_therapist": "d202aad7-bcb6-478c-a211-b00877545e05",
    "rmt": "d202aad7-bcb6-478c-a211-b00877545e05",
    "naturopath": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "naturopathic doctor": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "integrative medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "integrative medicine doctor": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "integrative medicine practitioner": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "functional medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "functional medicine doctor": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "functional medicine practitioner": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "acupuncturist": "154f93f4-54a5-4900-92e8-0fa217508127",
}

# Default pathway if type not found
DEFAULT_PATHWAY = "cf2233ef-7fb2-49ff-af29-0eee47204e9f"  # Chiropractors


def get_pathway_for_type(practitioner_type: str) -> str:
    """Get the appropriate pathway ID for a practitioner type."""
    type_lower = practitioner_type.lower().strip()
    return PATHWAYS.get(type_lower, DEFAULT_PATHWAY)


def format_phone_number(phone: str) -> str:
    """Format phone number to E.164 format for Canada."""
    if not phone:
        return None
    
    # Remove all non-numeric characters
    digits = ''.join(c for c in phone if c.isdigit())
    
    # Handle different formats
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits.startswith('1'):
        return f"+{digits}"
    elif len(digits) > 11:
        return f"+{digits[:11]}"
    else:
        return None


def make_personalized_call(
    phone_number: str,
    practice_name: str,
    practitioner_type: str,
    address: str = "",
    city: str = "",
    province: str = "",
    rating: float = None,
    review_count: int = None,
    website: str = "",
    **kwargs
) -> dict:
    """
    Make a personalized SuperPatch sales call with practice context.
    
    The pathway prompts can reference these variables:
    - {{practice_name}} - Name of the practice
    - {{practice_address}} - Full address
    - {{practice_city}} - City
    - {{practice_province}} - Province
    - {{google_rating}} - Google rating (e.g., "4.8")
    - {{review_count}} - Number of reviews
    - {{website}} - Practice website
    - {{practitioner_type}} - Type of practitioner
    """
    formatted_phone = format_phone_number(phone_number)
    if not formatted_phone:
        return {"error": f"Invalid phone number: {phone_number}"}
    
    pathway_id = get_pathway_for_type(practitioner_type)
    
    # Build request_data with practice context
    request_data = {
        "practice_name": practice_name or "your practice",
        "practice_address": address or "",
        "practice_city": city or "",
        "practice_province": province or "",
        "google_rating": str(rating) if rating else "",
        "review_count": str(review_count) if review_count else "",
        "website": website or "",
        "practitioner_type": practitioner_type or "",
        # Flag that we have the address (for scheduling confirmation)
        "has_address": "true" if address else "false",
    }
    
    # Build the first sentence with personalization
    first_sentence = f"Hi, this is Jennifer with SuperPatch. Am I speaking with someone from {practice_name}?"
    
    payload = {
        "phone_number": formatted_phone,
        "pathway_id": pathway_id,
        "pathway_version": 1,
        "knowledge_base": KB_ID,
        "voice": kwargs.get("voice", "78c8543e-e5fe-448e-8292-20a7b8c45247"),
        "first_sentence": first_sentence,
        "wait_for_greeting": kwargs.get("wait_for_greeting", True),
        "record": kwargs.get("record", True),
        "max_duration": kwargs.get("max_duration", 15),
        "webhook": kwargs.get("webhook", "https://sales-enablement-six.vercel.app/api/webhooks/bland"),
        "request_data": request_data,
        "metadata": {
            "campaign": "canadian_practitioners",
            "source": "google_maps_scraper",
            "practice_name": practice_name,
            "practitioner_type": practitioner_type,
        }
    }
    
    cmd = f'''curl -s -X POST "https://api.bland.ai/v1/calls" \
        -H "authorization: {API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{json.dumps(payload)}' '''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    try:
        response = json.loads(result.stdout)
        response["practice_name"] = practice_name
        response["phone_called"] = formatted_phone
        return response
    except:
        return {"error": result.stdout, "stderr": result.stderr}


def load_practitioners_from_csv(filepath: str) -> list:
    """Load practitioners from CSV file."""
    practitioners = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            practitioners.append(row)
    return practitioners


def load_practitioners_from_json(filepath: str) -> list:
    """Load practitioners from JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('practitioners', data)


def filter_callable_practitioners(practitioners: list) -> list:
    """Filter to only practitioners with valid phone numbers."""
    callable_list = []
    for p in practitioners:
        phone = p.get('phone', '')
        if phone and format_phone_number(phone):
            callable_list.append(p)
    return callable_list


def run_campaign(
    practitioners: list,
    limit: int = None,
    delay_seconds: int = 60,
    dry_run: bool = False,
    practitioner_type_filter: str = None,
    province_filter: str = None,
    min_rating: float = None,
    **call_kwargs
) -> dict:
    """
    Run a campaign calling multiple practitioners.
    
    Args:
        practitioners: List of practitioner dicts from CSV/JSON
        limit: Maximum number of calls to make
        delay_seconds: Delay between calls (default 60s for rate limiting)
        dry_run: If True, just print what would be called
        practitioner_type_filter: Filter to specific type
        province_filter: Filter to specific province
        min_rating: Minimum Google rating to call
        **call_kwargs: Additional args passed to make_personalized_call
    
    Returns:
        Campaign results summary
    """
    # Filter practitioners
    filtered = practitioners
    
    if practitioner_type_filter:
        filtered = [p for p in filtered if practitioner_type_filter.lower() in p.get('practitioner_type', '').lower()]
    
    if province_filter:
        filtered = [p for p in filtered if province_filter.lower() in p.get('province', '').lower()]
    
    if min_rating:
        filtered = [p for p in filtered if float(p.get('rating', 0) or 0) >= min_rating]
    
    # Only keep callable practitioners
    callable_practitioners = filter_callable_practitioners(filtered)
    
    # Apply limit
    if limit:
        callable_practitioners = callable_practitioners[:limit]
    
    print(f"\n{'='*60}")
    print(f"SUPERPATCH CANADIAN CAMPAIGN")
    print(f"{'='*60}")
    print(f"Total practitioners loaded: {len(practitioners)}")
    print(f"After filters: {len(filtered)}")
    print(f"With valid phone: {len(callable_practitioners)}")
    print(f"Calls to make: {len(callable_practitioners)}")
    print(f"{'='*60}\n")
    
    if dry_run:
        print("DRY RUN - No calls will be made\n")
        for i, p in enumerate(callable_practitioners, 1):
            print(f"{i}. {p.get('name', 'Unknown')} ({p.get('practitioner_type', '')})")
            print(f"   Phone: {format_phone_number(p.get('phone', ''))}")
            print(f"   Address: {p.get('address', '')}")
            print(f"   Rating: {p.get('rating', 'N/A')} ({p.get('review_count', 0)} reviews)")
            print()
        return {"dry_run": True, "would_call": len(callable_practitioners)}
    
    # Make calls
    results = {
        "total": len(callable_practitioners),
        "successful": 0,
        "failed": 0,
        "calls": []
    }
    
    for i, p in enumerate(callable_practitioners, 1):
        print(f"\n[{i}/{len(callable_practitioners)}] Calling: {p.get('name', 'Unknown')}")
        print(f"   Phone: {format_phone_number(p.get('phone', ''))}")
        
        result = make_personalized_call(
            phone_number=p.get('phone', ''),
            practice_name=p.get('name', ''),
            practitioner_type=p.get('practitioner_type', ''),
            address=p.get('address', ''),
            city=p.get('city', ''),
            province=p.get('province', ''),
            rating=float(p.get('rating', 0) or 0) if p.get('rating') else None,
            review_count=int(p.get('review_count', 0) or 0) if p.get('review_count') else None,
            website=p.get('website', ''),
            **call_kwargs
        )
        
        results["calls"].append({
            "practice": p.get('name', ''),
            "phone": p.get('phone', ''),
            "result": result
        })
        
        if result.get('call_id'):
            results["successful"] += 1
            print(f"   ✓ Call initiated: {result.get('call_id')}")
        else:
            results["failed"] += 1
            print(f"   ✗ Failed: {result.get('error', 'Unknown error')}")
        
        # Delay between calls (except for last one)
        if i < len(callable_practitioners):
            print(f"   Waiting {delay_seconds}s before next call...")
            time.sleep(delay_seconds)
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"campaign_results_{timestamp}.json"
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"CAMPAIGN COMPLETE")
    print(f"{'='*60}")
    print(f"Successful calls: {results['successful']}")
    print(f"Failed calls: {results['failed']}")
    print(f"Results saved to: {results_file}")
    
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Make personalized SuperPatch sales calls")
    
    # Single call mode
    parser.add_argument("--phone", help="Phone number for single call")
    parser.add_argument("--practice-name", help="Practice name for single call")
    parser.add_argument("--type", help="Practitioner type (chiropractor, massage, etc.)")
    parser.add_argument("--address", default="", help="Practice address")
    parser.add_argument("--city", default="", help="City")
    parser.add_argument("--province", default="", help="Province")
    parser.add_argument("--rating", type=float, help="Google rating")
    parser.add_argument("--reviews", type=int, help="Review count")
    
    # Campaign mode
    parser.add_argument("--csv", help="CSV file with practitioner data")
    parser.add_argument("--json", help="JSON file with practitioner data")
    parser.add_argument("--limit", type=int, help="Maximum calls to make")
    parser.add_argument("--delay", type=int, default=60, help="Seconds between calls (default 60)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be called without calling")
    
    # Filters
    parser.add_argument("--filter-type", help="Filter to specific practitioner type")
    parser.add_argument("--filter-province", help="Filter to specific province")
    parser.add_argument("--min-rating", type=float, help="Minimum Google rating")
    
    args = parser.parse_args()
    
    if args.csv or args.json:
        # Campaign mode
        if args.csv:
            practitioners = load_practitioners_from_csv(args.csv)
        else:
            practitioners = load_practitioners_from_json(args.json)
        
        run_campaign(
            practitioners,
            limit=args.limit,
            delay_seconds=args.delay,
            dry_run=args.dry_run,
            practitioner_type_filter=args.filter_type,
            province_filter=args.filter_province,
            min_rating=args.min_rating
        )
    
    elif args.phone and args.practice_name:
        # Single call mode
        result = make_personalized_call(
            phone_number=args.phone,
            practice_name=args.practice_name,
            practitioner_type=args.type or "chiropractor",
            address=args.address,
            city=args.city,
            province=args.province,
            rating=args.rating,
            review_count=args.reviews
        )
        print(json.dumps(result, indent=2))
    
    else:
        parser.print_help()
        print("\nExamples:")
        print("  # Single call:")
        print('  python3 make_campaign_calls.py --phone "+16475551234" --practice-name "Toronto Wellness" --type chiropractor')
        print()
        print("  # Campaign from CSV (dry run):")
        print('  python3 make_campaign_calls.py --csv canadian_practitioners/all_practitioners_latest.csv --dry-run --limit 10')
        print()
        print("  # Campaign with filters:")
        print('  python3 make_campaign_calls.py --csv canadian_practitioners/all_practitioners_latest.csv --filter-type chiropractor --filter-province Ontario --min-rating 4.0 --limit 20')
