#!/usr/bin/env python3
"""
Update Bland.ai Custom Tools to use Cal.com API directly.
This creates/updates two tools:
1. Get Available Times - Checks Cal.com for available slots
2. Create Booking - Books appointment in Cal.com
"""

import json
import os
import subprocess
from pathlib import Path

BLAND_API_KEY = os.environ.get("BLAND_API_KEY")
CAL_COM_API_KEY = os.environ.get("CAL_COM_API_KEY")
if not BLAND_API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
if not CAL_COM_API_KEY:
    raise ValueError("CAL_COM_API_KEY environment variable is required")

# Load Cal.com and tool IDs from the canonical source of truth.
# See b2b_sales_enablement/bland_ai_pathways/canonical_ids.json.
_CANONICAL_PATH = (
    Path(__file__).parent.parent / "bland_ai_pathways" / "canonical_ids.json"
)
if not _CANONICAL_PATH.exists():
    raise FileNotFoundError(
        f"canonical_ids.json not found at {_CANONICAL_PATH}. "
        "This file is the source of truth for Bland.ai IDs."
    )

with _CANONICAL_PATH.open("r") as _f:
    _CANONICAL = json.load(_f)

CAL_COM_USERNAME = _CANONICAL["cal_com"]["username"]
CAL_COM_EVENT_TYPE_ID = _CANONICAL["cal_com"]["event_type_id"]
CAL_COM_EVENT_TYPE_SLUG = _CANONICAL["cal_com"]["event_type_slug"]

CHECK_AVAILABILITY_TOOL_ID = _CANONICAL["tools"]["check_availability"]["id"]
SCHEDULE_APPOINTMENT_TOOL_ID = _CANONICAL["tools"]["book_appointment"]["id"]


def update_check_availability_tool():
    """Update the check availability tool to use Cal.com API directly"""
    
    tool_config = {
        "tool": {
            "name": "check_cal_availability",
            "description": "Check available appointment slots from Cal.com calendar. Returns available times for booking a follow-up call.",
            "url": "https://api.cal.com/v1/slots",
            "method": "GET",
            "speech": "Let me check my calendar for available times...",
            "headers": {},
            "query": {
                "apiKey": CAL_COM_API_KEY,
                "eventTypeId": CAL_COM_EVENT_TYPE_ID,
                "startTime": "{{input.start_date}}",
                "endTime": "{{input.end_date}}",
                "timeZone": "{{input.timezone}}"
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date for availability check in ISO format (e.g., 2026-01-15T00:00:00Z)"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date for availability check in ISO format (e.g., 2026-01-22T23:59:59Z)"
                    },
                    "timezone": {
                        "type": "string",
                        "description": "Timezone for the slots (e.g., America/New_York). Default to America/New_York if not specified."
                    }
                },
                "required": ["start_date", "end_date"]
            },
            "response": {
                "available_slots": "$.slots"
            }
        }
    }
    
    print("Updating Check Availability Tool...")
    print(f"Tool ID: {CHECK_AVAILABILITY_TOOL_ID}")
    
    cmd = f'''curl -s -X POST "https://api.bland.ai/v1/tools/{CHECK_AVAILABILITY_TOOL_ID}" \
      -H "authorization: {BLAND_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{json.dumps(tool_config)}' '''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(f"Response: {result.stdout}")
    return result.stdout


def update_schedule_appointment_tool():
    """Update the schedule appointment tool to use Cal.com API directly"""
    
    tool_config = {
        "tool": {
            "name": "book_cal_appointment",
            "description": "Book a follow-up appointment in Cal.com calendar. Creates a calendar event and sends confirmation to the attendee.",
            "url": "https://api.cal.com/v1/bookings",
            "method": "POST",
            "speech": "Let me book that appointment for you...",
            "headers": {
                "Content-Type": "application/json"
            },
            "query": {
                "apiKey": CAL_COM_API_KEY
            },
            "body": {
                "eventTypeId": int(CAL_COM_EVENT_TYPE_ID),
                "start": "{{input.start_time}}",
                "responses": {
                    "name": "{{input.name}}",
                    "email": "{{input.email}}",
                    "phone": "{{input.phone}}",
                    "notes": "{{input.notes}}"
                },
                "timeZone": "{{input.timezone}}",
                "language": "en",
                "metadata": {
                    "source": "bland_ai_voice_agent",
                    "practitioner_type": "{{input.practitioner_type}}",
                    "products_interested": "{{input.products_interested}}",
                    "practice_name": "{{input.practice_name}}"
                }
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "start_time": {
                        "type": "string",
                        "description": "Start time of the booking in ISO format (e.g., 2026-01-15T10:00:00-05:00)"
                    },
                    "name": {
                        "type": "string",
                        "description": "Full name of the person being booked"
                    },
                    "email": {
                        "type": "string",
                        "description": "Email address for calendar invite and confirmation"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Phone number of the attendee"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Any notes about the appointment (products interested, concerns, etc.)"
                    },
                    "timezone": {
                        "type": "string",
                        "description": "Timezone of the attendee (e.g., America/New_York)"
                    },
                    "practitioner_type": {
                        "type": "string",
                        "description": "Type of practitioner: chiropractor, massage therapist, naturopath, etc."
                    },
                    "products_interested": {
                        "type": "string",
                        "description": "Products the practitioner showed interest in"
                    },
                    "practice_name": {
                        "type": "string",
                        "description": "Name of the practice or clinic"
                    }
                },
                "required": ["start_time", "name", "email"]
            },
            "response": {
                "booking_id": "$.id",
                "booking_uid": "$.uid",
                "confirmation_message": "$.message",
                "start_time": "$.startTime",
                "end_time": "$.endTime"
            }
        }
    }
    
    print("\nUpdating Schedule Appointment Tool...")
    print(f"Tool ID: {SCHEDULE_APPOINTMENT_TOOL_ID}")
    
    cmd = f'''curl -s -X POST "https://api.bland.ai/v1/tools/{SCHEDULE_APPOINTMENT_TOOL_ID}" \
      -H "authorization: {BLAND_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{json.dumps(tool_config)}' '''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(f"Response: {result.stdout}")
    return result.stdout


def test_cal_com_availability():
    """Test the Cal.com availability API"""
    from datetime import datetime, timedelta
    
    start = datetime.now()
    end = start + timedelta(days=7)
    
    print("\n" + "="*60)
    print("Testing Cal.com Availability API...")
    
    cmd = f'''curl -s "https://api.cal.com/v1/slots?apiKey={CAL_COM_API_KEY}&eventTypeId={CAL_COM_EVENT_TYPE_ID}&startTime={start.strftime('%Y-%m-%dT00:00:00Z')}&endTime={end.strftime('%Y-%m-%dT23:59:59Z')}&timeZone=America/New_York"'''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    try:
        data = json.loads(result.stdout)
        slots = data.get('slots', {})
        print(f"\nFound slots for {len(slots)} days:")
        for date, times in list(slots.items())[:3]:
            print(f"  {date}: {len(times)} slots available")
            for time in times[:3]:
                print(f"    - {time}")
    except:
        print(f"Response: {result.stdout[:500]}")


if __name__ == "__main__":
    print("="*60)
    print("UPDATING BLAND.AI TOOLS FOR CAL.COM INTEGRATION")
    print("="*60)
    print(f"\nCal.com Configuration:")
    print(f"  Username: {CAL_COM_USERNAME}")
    print(f"  Event Type ID: {CAL_COM_EVENT_TYPE_ID}")
    print(f"  Event Type Slug: {CAL_COM_EVENT_TYPE_SLUG}")
    
    # Test Cal.com first
    test_cal_com_availability()
    
    # Update tools
    print("\n" + "="*60)
    print("UPDATING BLAND TOOLS")
    print("="*60)
    
    update_check_availability_tool()
    update_schedule_appointment_tool()
    
    print("\n" + "="*60)
    print("DONE!")
    print("="*60)
    print("\nThe Bland.ai tools have been updated to use Cal.com directly.")
    print("Available slots will be fetched from your Cal.com calendar.")
    print("Bookings will create calendar events with confirmation emails.")
