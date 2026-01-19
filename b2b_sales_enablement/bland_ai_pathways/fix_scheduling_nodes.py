"""
Fix the Schedule Appointment nodes to include end_time parameter.
"""

import json
import subprocess

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

PATHWAYS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage_Therapists": "d202aad7-bcb6-478c-a211-b00877545e05",
    "Naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "Integrative_Medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "Functional_Medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "Acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

SCHEDULE_APPOINTMENT_PROMPT = """You're booking the IN-PERSON sales visit where a SuperPatch rep will visit their practice with samples and provide a demonstration.

## What You're Booking
- In-person visit to their practice/clinic
- Rep will bring product samples
- Rep will demonstrate how the patches work
- Duration: 30 minutes

## CRITICAL: Information Required for Booking
You MUST collect these before calling the booking tool:

1. **start_time** - The time they chose (ISO format, e.g., "2026-01-15T10:00:00Z")
2. **end_time** - 30 minutes after start time (e.g., "2026-01-15T10:30:00Z")
3. **name** - Their name (Dr. [Name])
4. **email** - For the calendar invite (REQUIRED - ask specifically!)
5. **address** - Practice address for the in-person visit
6. **timezone** - Their timezone (default: "America/New_York")
7. **practitioner_type** - Type of practitioner
8. **practice_name** - Name of their practice
9. **products_interested** - What products they want to see

## Getting the Email (CRITICAL)
You MUST ask for their email:
"What's the best email for the calendar invite? That way you'll have all the details including the meeting link."

## Getting the Address
"And what's the address for your practice so the rep knows where to go?"

## Calculating End Time
When they select a time, you need to calculate end_time as 30 minutes later:
- If start is 10:00 AM → end is 10:30 AM
- If start is 2:00 PM → end is 2:30 PM

Example: 
- start_time: "2026-01-15T14:00:00Z" (2 PM)
- end_time: "2026-01-15T14:30:00Z" (2:30 PM)

## Calling the Booking Tool
When calling book_cal_appointment, provide ALL these:
- start_time: ISO format (e.g., "2026-01-15T14:00:00-05:00")
- end_time: ISO format, 30 min after start (e.g., "2026-01-15T14:30:00-05:00")
- name: "Dr. Smith" or their name
- email: "drsmith@clinic.com" (REQUIRED)
- address: "123 Main St, City, State"
- timezone: "America/New_York"
- practitioner_type: "chiropractor" etc.
- practice_name: "Smith Chiropractic"
- products_interested: "Freedom, REM"
- notes: Any additional notes

## After Successful Booking
Confirm the details:
"You're all set! I have a rep scheduled to visit [Practice Name] on [Day] at [Time]. They'll bring samples of [products] and give you a hands-on demo."

"You'll get a calendar invite at [email] with all the details. The booking confirmation is [booking_uid]."

## If Booking Fails
"I'm having trouble completing the booking. Let me make sure I have everything correct..."
Then verify email format and try again.

## What NOT to Do
- Don't forget to get the EMAIL - the booking will fail without it!
- Don't forget to calculate end_time (30 min after start)
- Don't skip confirming the details back to them"""

CHECK_AVAILABILITY_PROMPT = """You're checking Cal.com calendar for available times to schedule an IN-PERSON sales visit.

## What This Appointment Is For
- A SuperPatch sales representative will visit their practice IN PERSON
- They'll bring product samples for the practitioner to try
- They'll provide a hands-on demonstration
- The visit takes about 30 minutes

## Before Checking Availability
Frame it properly:
"Great! So what we'd like to do is have one of our reps stop by your practice to drop off some samples and give you a quick demo. It only takes about 30 minutes. Would sometime this week or next week work better?"

## Calling the check_cal_availability Tool
When calling the tool, provide:
- start_date: Start of date range in ISO format (e.g., "2026-01-15T00:00:00Z")
- end_date: End of date range in ISO format (e.g., "2026-01-22T23:59:59Z")
- timezone: Their timezone (default "America/New_York")

## After Getting Available Times
The tool returns available slots. Present 2-3 options naturally:
"Okay, I have a rep available on [Day] around [time], or [Day] at [time]. Which works better for you?"

## Get Their Email Early
While discussing times, ask for their email:
"And what's the best email for the calendar invite?"

## Once They Pick a Time
Say: "Perfect! [Day] at [time] works great. Let me get that booked..."
Then route to Schedule Appointment.

## What NOT to Do
- Don't make it sound like a phone call - it's an IN-PERSON visit
- Don't forget to get their email
- Don't offer too many options at once"""


def update_pathway(name, pathway_id):
    """Update a pathway's scheduling nodes."""
    
    # Get current pathway
    cmd = f'curl -s -X GET "https://api.bland.ai/v1/pathway/{pathway_id}" -H "authorization: {API_KEY}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    pathway = json.loads(result.stdout)
    
    nodes = pathway.get('nodes', [])
    edges = pathway.get('edges', [])
    
    # Update scheduling nodes
    for node in nodes:
        node_name = node.get('data', {}).get('name', '')
        
        if node_name == 'Schedule Appointment':
            node['data']['prompt'] = SCHEDULE_APPOINTMENT_PROMPT
            node['data']['tool'] = "TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526"
            node['type'] = "Webhook"
            print(f"  Updated: Schedule Appointment")
            
        elif node_name == 'Check Availability':
            node['data']['prompt'] = CHECK_AVAILABILITY_PROMPT
            node['data']['tool'] = "TL-79a3c232-ca51-4244-b5d2-21f4e70fd872"
            node['type'] = "Webhook"
            print(f"  Updated: Check Availability")
    
    # Save and deploy
    payload = {
        "name": pathway.get('name', f"SuperPatch - {name} Sales"),
        "description": pathway.get('description', ''),
        "nodes": nodes,
        "edges": edges
    }
    
    # Deploy main pathway
    with open('temp_pathway.json', 'w') as f:
        json.dump(payload, f)
    
    cmd1 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @temp_pathway.json'
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    # Deploy version 1
    cmd2 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @temp_pathway.json'
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    try:
        s1 = json.loads(r1.stdout).get('status', 'error')
        s2 = json.loads(r2.stdout).get('status', 'error')
        return s1 == 'success' or s2 == 'success'
    except:
        return False


if __name__ == "__main__":
    print("="*60)
    print("FIXING SCHEDULING NODES WITH CORRECT CAL.COM FORMAT")
    print("="*60)
    print("\nKey fixes:")
    print("  - Added end_time parameter (required by Cal.com)")
    print("  - Added email collection instructions")
    print("  - Updated booking tool with correct format")
    
    for name, pathway_id in PATHWAYS.items():
        print(f"\n{name}:")
        success = update_pathway(name, pathway_id)
        if success:
            print(f"  ✓ Deployed")
        else:
            print(f"  ✗ Error")
    
    print("\n" + "="*60)
    print("DONE")
    print("="*60)
