"""
Tests for the Bland.ai tool-config builders in
`update_bland_tools_calcom.py`.

These configs are POSTed to Bland.ai and then invoked by the voice agent
mid-call against Cal.com. Cal.com v1 was retired 2026-04-08, so any v1
URL or v1 body shape that slips through here means in-call availability
lookups and tool-triggered bookings will 404 silently. The tests assert
the contract we expect Cal.com v2 to accept, drawn from:

  - https://cal.com/docs/api-reference/v2/slots/get-available-time-slots-for-an-event-type
  - https://cal.com/docs/api-reference/v2/bookings/create-a-booking
"""

from update_bland_tools_calcom import (
    build_check_availability_config,
    build_book_appointment_config,
)


CAL_API_KEY = "cal_live_test_key_12345"
EVENT_TYPE_ID = "4352394"


def _tool(config: dict) -> dict:
    """Tool configs are nested under {"tool": {...}} for the Bland API."""
    assert "tool" in config, "tool config must be wrapped in {'tool': {...}}"
    return config["tool"]


# ---------------------------------------------------------------------------
# check_availability (GET /v2/slots)
# ---------------------------------------------------------------------------


def test_check_availability_uses_v2_slots_url():
    tool = _tool(build_check_availability_config(CAL_API_KEY, EVENT_TYPE_ID))
    assert tool["url"] == "https://api.cal.com/v2/slots", (
        f"check_availability must point at Cal.com v2, got {tool['url']!r}. "
        "v1 was retired 2026-04-08."
    )
    assert tool["method"] == "GET"


def test_check_availability_sends_bearer_auth_in_headers_not_query():
    tool = _tool(build_check_availability_config(CAL_API_KEY, EVENT_TYPE_ID))
    headers = tool.get("headers", {})
    assert headers.get("Authorization") == f"Bearer {CAL_API_KEY}", (
        "Cal.com v2 uses Bearer auth, not the v1 ?apiKey= query param."
    )
    query = tool.get("query", {})
    assert "apiKey" not in query, (
        "v1 ?apiKey= query parameter must not be present in v2 tool config."
    )


def test_check_availability_sets_cal_api_version_header():
    tool = _tool(build_check_availability_config(CAL_API_KEY, EVENT_TYPE_ID))
    headers = tool.get("headers", {})
    # Cal.com docs publish 2024-09-04 as the stable version for /v2/slots.
    assert headers.get("cal-api-version") == "2024-09-04", (
        "Cal.com v2 requires the cal-api-version header. Use 2024-09-04 "
        "(the stable slots version per Cal.com docs)."
    )


def test_check_availability_query_uses_v2_param_names():
    tool = _tool(build_check_availability_config(CAL_API_KEY, EVENT_TYPE_ID))
    query = tool.get("query", {})
    # v2 renamed startTime/endTime -> start/end and accepts plain dates.
    assert "start" in query and "end" in query, (
        f"v2 /slots uses `start` and `end`, not v1's startTime/endTime. Got {list(query)}."
    )
    assert "startTime" not in query and "endTime" not in query, (
        "v1's startTime/endTime are not valid v2 parameters."
    )
    assert query["eventTypeId"] == EVENT_TYPE_ID
    # timeZone is optional in v2 but should be passed through from the LLM.
    assert "timeZone" in query


def test_check_availability_response_unwraps_v2_envelope():
    tool = _tool(build_check_availability_config(CAL_API_KEY, EVENT_TYPE_ID))
    response = tool.get("response", {})
    # v2 wraps everything in { status, data }. v1 returned { slots: ... }.
    # The Bland agent reads `available_slots`, so the JSONPath must walk
    # into `data`, not the retired `slots` root.
    available = response.get("available_slots", "")
    assert available.startswith("$.data"), (
        f"available_slots JSONPath must read from $.data (v2 envelope), got {available!r}."
    )


# ---------------------------------------------------------------------------
# book_appointment (POST /v2/bookings)
# ---------------------------------------------------------------------------


def test_book_appointment_uses_v2_bookings_url():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    assert tool["url"] == "https://api.cal.com/v2/bookings", (
        f"book_appointment must point at Cal.com v2, got {tool['url']!r}."
    )
    assert tool["method"] == "POST"


def test_book_appointment_sends_bearer_auth_in_headers():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    headers = tool.get("headers", {})
    assert headers.get("Authorization") == f"Bearer {CAL_API_KEY}"
    assert headers.get("Content-Type") == "application/json"
    query = tool.get("query", {}) or {}
    assert "apiKey" not in query, "v1 ?apiKey= must not appear in the v2 tool config."


def test_book_appointment_sets_cal_api_version_header():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    headers = tool.get("headers", {})
    # The Edge Function (supabase/functions/_shared/cal.ts) defaults
    # /v2/bookings to 2026-02-25; we mirror that here.
    assert headers.get("cal-api-version") == "2026-02-25"


def test_book_appointment_body_uses_v2_attendee_shape():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    body = tool.get("body", {})
    # v2 dropped `responses` in favour of a single `attendee` object.
    assert "responses" not in body, (
        "v1 used { responses: { name, email, ... } }; v2 uses { attendee: {...} }."
    )
    assert "attendee" in body, "v2 /bookings requires an `attendee` object."
    attendee = body["attendee"]
    for key in ("name", "email", "timeZone"):
        assert key in attendee, f"attendee must include {key} (v2 contract)."
    # phoneNumber is optional but should be wired so the LLM can pass it
    # through to Cal.com (used for SMS reminders).
    assert "phoneNumber" in attendee


def test_book_appointment_body_keeps_event_type_id_and_start():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    body = tool["body"]
    assert body["eventTypeId"] == int(EVENT_TYPE_ID)
    assert body["start"] == "{{input.start_time}}"


def test_book_appointment_body_preserves_metadata():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    metadata = tool["body"].get("metadata", {})
    assert metadata.get("source") == "bland_ai_voice_agent"
    # The webhook-processor reads metadata.call_record_id when reconciling
    # bookings to call records; the tool must at least pass through
    # practitioner_type / practice_name so they land on the booking.
    for key in ("practitioner_type", "practice_name", "products_interested"):
        assert key in metadata, f"metadata must carry {key} through to Cal.com."


def test_book_appointment_response_unwraps_v2_envelope():
    tool = _tool(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    response = tool.get("response", {})
    # v2 wraps the booking in { status, data: {...} }. The Bland agent
    # reads `booking_uid`; the JSONPath must descend into `data`.
    assert response.get("booking_uid", "").startswith("$.data"), (
        f"booking_uid JSONPath must walk into $.data (v2 envelope), got {response.get('booking_uid')!r}."
    )
    assert response.get("booking_id", "").startswith("$.data")


def test_no_v1_urls_anywhere_in_configs():
    """Defense in depth: zero `/v1/` substrings in either tool config."""
    import json as _json

    a = _json.dumps(build_check_availability_config(CAL_API_KEY, EVENT_TYPE_ID))
    b = _json.dumps(build_book_appointment_config(CAL_API_KEY, EVENT_TYPE_ID))
    assert "api.cal.com/v1" not in a
    assert "api.cal.com/v1" not in b
