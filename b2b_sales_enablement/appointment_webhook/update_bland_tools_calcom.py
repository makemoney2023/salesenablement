#!/usr/bin/env python3
"""
Update Bland.ai Custom Tools to use Cal.com API directly.

This pushes two Bland.ai custom-tool definitions that the voice agent
invokes mid-call:

  1. check_cal_availability  -> GET  https://api.cal.com/v2/slots
  2. book_cal_appointment    -> POST https://api.cal.com/v2/bookings

Cal.com v1 was retired 2026-04-08, so every tool config below targets
v2 with the documented `cal-api-version` header and Bearer auth (not the
v1 ?apiKey= query parameter). The Bland.ai tool definitions are pure
functions (`build_check_availability_config`, `build_book_appointment_config`)
so they can be exercised by pytest without hitting the network — see
test_update_bland_tools_calcom.py.

Run:

  BLAND_API_KEY=... CAL_COM_API_KEY=... \
    python3 update_bland_tools_calcom.py

The Cal.com event type id, username, and tool IDs are loaded from
b2b_sales_enablement/bland_ai_pathways/canonical_ids.json (the single
source of truth).
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict

import requests

# Cal.com v2 versions. The slots endpoint stayed on the 2024-09-04 release;
# bookings moved to 2026-02-25 (same version the Edge Function uses).
CAL_API_VERSION_SLOTS = "2024-09-04"
CAL_API_VERSION_BOOKINGS = "2026-02-25"

CAL_BASE_URL = "https://api.cal.com/v2"
BLAND_TOOLS_BASE_URL = "https://api.bland.ai/v1/tools"

# Default timezone for the LLM-facing tool descriptions. Matches
# BUSINESS_TIMEZONE in the book-appointment Edge Function so we don't
# split-brain across the two booking paths.
DEFAULT_TIMEZONE = "America/Toronto"


# ---------------------------------------------------------------------------
# Pure builders (no I/O — exercised by pytest)
# ---------------------------------------------------------------------------


def build_check_availability_config(
    cal_api_key: str,
    event_type_id: str,
) -> Dict[str, Any]:
    """Return the Bland.ai tool config for GET /v2/slots."""
    return {
        "tool": {
            "name": "check_cal_availability",
            "description": (
                "Check available appointment slots from Cal.com calendar. "
                "Returns available times for booking a follow-up call. "
                f"Pass dates in YYYY-MM-DD format and timezone (default {DEFAULT_TIMEZONE})."
            ),
            "url": f"{CAL_BASE_URL}/slots",
            "method": "GET",
            "speech": "Let me check my calendar for available times...",
            "headers": {
                "Authorization": f"Bearer {cal_api_key}",
                "cal-api-version": CAL_API_VERSION_SLOTS,
            },
            "query": {
                "eventTypeId": event_type_id,
                "start": "{{input.start_date}}",
                "end": "{{input.end_date}}",
                "timeZone": "{{input.timezone}}",
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": (
                            "Start date for availability check in YYYY-MM-DD format "
                            "(e.g., 2026-05-15). The Cal.com v2 /slots endpoint accepts "
                            "plain dates, not full ISO datetimes."
                        ),
                    },
                    "end_date": {
                        "type": "string",
                        "description": (
                            "End date for availability check in YYYY-MM-DD format "
                            "(e.g., 2026-05-22). Inclusive."
                        ),
                    },
                    "timezone": {
                        "type": "string",
                        "description": (
                            f"IANA timezone for the slots (e.g., {DEFAULT_TIMEZONE}). "
                            f"Default to {DEFAULT_TIMEZONE} if not specified by the caller."
                        ),
                    },
                },
                "required": ["start_date", "end_date"],
            },
            # Cal.com v2 wraps everything in { status, data: {...} }. v1's
            # `$.slots` no longer exists.
            "response": {
                "available_slots": "$.data",
            },
        },
    }


def build_book_appointment_config(
    cal_api_key: str,
    event_type_id: str,
) -> Dict[str, Any]:
    """Return the Bland.ai tool config for POST /v2/bookings."""
    return {
        "tool": {
            "name": "book_cal_appointment",
            "description": (
                "Book a follow-up appointment in Cal.com calendar. Creates a "
                "calendar event and sends confirmation to the attendee."
            ),
            "url": f"{CAL_BASE_URL}/bookings",
            "method": "POST",
            "speech": "Let me book that appointment for you...",
            "headers": {
                "Authorization": f"Bearer {cal_api_key}",
                "cal-api-version": CAL_API_VERSION_BOOKINGS,
                "Content-Type": "application/json",
            },
            "body": {
                "eventTypeId": int(event_type_id),
                "start": "{{input.start_time}}",
                # v2 collapses v1's `responses` shape into a single attendee.
                "attendee": {
                    "name": "{{input.name}}",
                    "email": "{{input.email}}",
                    "phoneNumber": "{{input.phone}}",
                    "timeZone": "{{input.timezone}}",
                },
                "metadata": {
                    "source": "bland_ai_voice_agent",
                    "practitioner_type": "{{input.practitioner_type}}",
                    "products_interested": "{{input.products_interested}}",
                    "practice_name": "{{input.practice_name}}",
                    "notes": "{{input.notes}}",
                    # Orphan-linking fallback for sync-cal-bookings. These are
                    # pathway-scoped variables (NOT input_schema fields), so
                    # they use the bare `{{var}}` form rather than `{{input.*}}`.
                    # `call_id` is the Bland built-in call id; `call_record_id`
                    # is populated from request_data when available (empty
                    # otherwise — sync-cal-bookings skips empty values).
                    "call_record_id": "{{call_record_id}}",
                    "call_id": "{{call_id}}",
                },
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "start_time": {
                        "type": "string",
                        "description": (
                            "Start time of the booking in ISO 8601 format with timezone "
                            "(e.g., 2026-05-15T10:00:00-04:00). Cal.com v2 requires a full "
                            "ISO datetime here even though /slots accepts plain dates."
                        ),
                    },
                    "name": {
                        "type": "string",
                        "description": "Full name of the person being booked.",
                    },
                    "email": {
                        "type": "string",
                        "description": (
                            "Email address for the calendar invite and confirmation. "
                            "Must be a valid RFC 5322 address — the Edge webhook will "
                            "reject malformed addresses downstream."
                        ),
                    },
                    "phone": {
                        "type": "string",
                        "description": (
                            "Phone number of the attendee in international E.164 format "
                            "(e.g., +14165551234). Required if the event type has SMS "
                            "reminders enabled."
                        ),
                    },
                    "notes": {
                        "type": "string",
                        "description": (
                            "Any notes about the appointment (products interested, "
                            "concerns, etc.). Travels in `metadata.notes`."
                        ),
                    },
                    "timezone": {
                        "type": "string",
                        "description": (
                            f"Attendee's IANA timezone (e.g., {DEFAULT_TIMEZONE})."
                        ),
                    },
                    "practitioner_type": {
                        "type": "string",
                        "description": (
                            "Practitioner type slug — one of chiropractor, "
                            "massage_therapist, naturopath, integrative_medicine, "
                            "functional_medicine, acupuncturist."
                        ),
                    },
                    "products_interested": {
                        "type": "string",
                        "description": "Products the practitioner showed interest in.",
                    },
                    "practice_name": {
                        "type": "string",
                        "description": "Name of the practice or clinic.",
                    },
                },
                "required": ["start_time", "name", "email"],
            },
            # v2 envelope: { status, data: { id, uid, status, start, end, ... } }
            # These response keys become Bland pathway variables that the
            # post-call webhook forwards (e.g. {{booking_uid}}). The
            # webhook-processor reads booking_uid to record the in-call
            # booking and skip a duplicate post-call booking.
            "response": {
                "booking_id": "$.data.id",
                "booking_uid": "$.data.uid",
                "booking_status": "$.data.status",
                "confirmation_message": "$.data.title",
                "start_time": "$.data.start",
                "end_time": "$.data.end",
            },
        },
    }


# ---------------------------------------------------------------------------
# I/O — load canonical config, push tools, run smoke check
# ---------------------------------------------------------------------------


def _load_canonical() -> Dict[str, Any]:
    canonical_path = (
        Path(__file__).parent.parent / "bland_ai_pathways" / "canonical_ids.json"
    )
    if not canonical_path.exists():
        raise FileNotFoundError(
            f"canonical_ids.json not found at {canonical_path}. "
            "This file is the source of truth for Bland.ai IDs."
        )
    with canonical_path.open("r") as f:
        return json.load(f)


def push_tool(
    tool_id: str,
    config: Dict[str, Any],
    bland_api_key: str,
) -> Dict[str, Any]:
    """POST a tool config to Bland.ai. Returns the parsed response body."""
    url = f"{BLAND_TOOLS_BASE_URL}/{tool_id}"
    response = requests.post(
        url,
        headers={
            "authorization": bland_api_key,
            "Content-Type": "application/json",
        },
        json=config,
        timeout=30,
    )
    try:
        return response.json()
    except ValueError:
        return {"status_code": response.status_code, "text": response.text}


def smoke_check_cal_v2_slots(
    cal_api_key: str,
    event_type_id: str,
) -> None:
    """Hit /v2/slots once to confirm the credentials + version are accepted."""
    start = datetime.utcnow().date()
    end = start + timedelta(days=7)

    response = requests.get(
        f"{CAL_BASE_URL}/slots",
        headers={
            "Authorization": f"Bearer {cal_api_key}",
            "cal-api-version": CAL_API_VERSION_SLOTS,
        },
        params={
            "eventTypeId": event_type_id,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "timeZone": DEFAULT_TIMEZONE,
        },
        timeout=15,
    )

    print(f"\nCal.com v2 /slots smoke check -> HTTP {response.status_code}")
    if response.status_code != 200:
        print(f"  Body: {response.text[:500]}")
        return

    try:
        body = response.json()
    except ValueError:
        print(f"  Non-JSON body: {response.text[:200]}")
        return

    data = body.get("data") or {}
    if not isinstance(data, dict):
        print(f"  Unexpected envelope: {body}")
        return

    print(f"  Found slots for {len(data)} day(s) in window [{start} .. {end}]")
    for date, times in list(data.items())[:3]:
        count = len(times) if isinstance(times, list) else 0
        print(f"    {date}: {count} slots")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main() -> int:
    bland_api_key = os.environ.get("BLAND_API_KEY")
    cal_api_key = os.environ.get("CAL_COM_API_KEY")
    if not bland_api_key:
        print("BLAND_API_KEY environment variable is required", file=sys.stderr)
        return 1
    if not cal_api_key:
        print("CAL_COM_API_KEY environment variable is required", file=sys.stderr)
        return 1

    canonical = _load_canonical()
    cal_username = canonical["cal_com"]["username"]
    event_type_id = canonical["cal_com"]["event_type_id"]
    event_type_slug = canonical["cal_com"]["event_type_slug"]

    check_availability_tool_id = canonical["tools"]["check_availability"]["id"]
    book_appointment_tool_id = canonical["tools"]["book_appointment"]["id"]

    print("=" * 60)
    print("UPDATING BLAND.AI TOOLS FOR CAL.COM v2 INTEGRATION")
    print("=" * 60)
    print(f"  Username:       {cal_username}")
    print(f"  Event Type ID:  {event_type_id}")
    print(f"  Event Type:     {event_type_slug}")
    print(f"  Slots ver:      {CAL_API_VERSION_SLOTS}")
    print(f"  Bookings ver:   {CAL_API_VERSION_BOOKINGS}")

    smoke_check_cal_v2_slots(cal_api_key, event_type_id)

    print("\n" + "=" * 60)
    print("PUSHING UPDATED TOOL CONFIGS TO BLAND.AI")
    print("=" * 60)

    print(f"\nUpdating check_cal_availability (tool id: {check_availability_tool_id})...")
    check_config = build_check_availability_config(cal_api_key, event_type_id)
    result = push_tool(check_availability_tool_id, check_config, bland_api_key)
    print(f"  Response: {json.dumps(result)[:500]}")

    print(f"\nUpdating book_cal_appointment (tool id: {book_appointment_tool_id})...")
    book_config = build_book_appointment_config(cal_api_key, event_type_id)
    result = push_tool(book_appointment_tool_id, book_config, bland_api_key)
    print(f"  Response: {json.dumps(result)[:500]}")

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)
    print(
        "\nThe Bland.ai tools now target Cal.com v2. Mid-call availability "
        "lookups and tool-triggered bookings should resolve against /v2."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
