import json
import subprocess
from datetime import datetime, timedelta

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

PATHWAYS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage Therapists": "d202aad7-bcb6-478c-a211-b00877545e05",
    "Naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "Integrative Medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "Functional Medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "Acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

# Load existing pathway and update just the scheduling nodes
def update_pathway_scheduling_prompts(practitioner, pathway_id):
    """Update the Check Availability and Schedule Appointment nodes with Cal.com specific prompts"""
    
    # Read current pathway
    filename = f"{practitioner.replace(' ', '_')}_expanded.json"
    
    try:
        with open(filename, 'r') as f:
            pathway = json.load(f)
    except:
        print(f"Could not load {filename}")
        return False
    
    # Find and update the scheduling nodes
    for node in pathway['nodes']:
        if node['data']['name'] == 'Check Availability':
            node['data']['prompt'] = '''You need to check the Cal.com calendar for available appointment slots.

## How This Works
You have a tool called "check_cal_availability" that queries the Cal.com calendar.

## Before Calling the Tool
Ask them about their preference:
"Let me check my calendar. Would next week work for you, or do you need something sooner?"

Wait for their response to understand their preference.

## Calling the Tool
When you call check_cal_availability, you need to provide:
- start_date: Start of the date range in ISO format (e.g., "2026-01-15T00:00:00Z")
- end_date: End of the date range in ISO format (e.g., "2026-01-22T23:59:59Z")  
- timezone: Their timezone (default to "America/New_York" if not specified)

## After Getting Results
The tool will return available time slots. Present 2-3 good options:

"Okay, I have some openings. How about [Day] at [time], or [Day] at [time]? Which works better for you?"

If no slots available in the range:
"Hmm, that week is pretty booked up. Want me to check the following week?"

## Once They Pick a Time
Confirm their choice and move to booking:
"Perfect, [Day] at [time]. Let me get that booked for you..."

Then route to Schedule Appointment node.

## What NOT to Do
- Don't offer more than 3 options at once
- Don't read out times in a list - make it conversational
- Don't forget to confirm before booking'''

        elif node['data']['name'] == 'Schedule Appointment':
            node['data']['prompt'] = '''You're booking the appointment in Cal.com.

## How This Works
You have a tool called "book_cal_appointment" that creates the calendar booking.

## Information Needed
Before booking, you need:
1. start_time - The exact time they chose (ISO format, e.g., "2026-01-15T10:00:00-05:00")
2. name - Their full name
3. email - Email for the calendar invite (REQUIRED - they won't get the invite without it)
4. phone - Phone number (optional but helpful)
5. timezone - Their timezone (default: "America/New_York")
6. Optional: practitioner_type, practice_name, products_interested, notes

## Getting Their Email
If you don't have their email yet:
"Great! And what's the best email to send the calendar invite to?"

## Calling the Tool
When calling book_cal_appointment, provide:
- start_time: ISO format time (e.g., "2026-01-15T10:00:00-05:00")
- name: Their name
- email: Their email
- phone: Phone number if you have it
- timezone: "America/New_York" or their stated timezone
- notes: Summary of what they're interested in
- practitioner_type: Type of practitioner
- practice_name: Name of their practice
- products_interested: Products they showed interest in

## After Booking
The tool will return a booking confirmation. Tell them:

"You're all set! I've got you down for [Day] at [Time]. You'll get a calendar invite at [email] with the meeting link. Your confirmation number is [booking_uid]."

"Before our call, I'll send over some info about [products they were interested in] so you can take a look."

"Any questions before I let you go?"

## If Booking Fails
"Hmm, that time slot just got taken. Let me check for another opening..."
Then go back to check availability.

## What NOT to Do
- Don't skip getting the email - they need it for the calendar invite
- Don't forget to read back the confirmation
- Don't rush through - this is an important moment'''
    
    # Save updated pathway
    with open(filename, 'w') as f:
        json.dump(pathway, f, indent=2)
    
    # Deploy to Bland
    print(f"Deploying updated scheduling nodes for {practitioner}...")
    
    cmd1 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    cmd2 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    try:
        s1 = json.loads(r1.stdout).get('status', 'error')
        s2 = json.loads(r2.stdout).get('status', 'error')
        print(f"  Main: {s1}, V1: {s2}")
        return s1 == 'success'
    except Exception as e:
        print(f"  Error: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("UPDATING SCHEDULING NODES WITH CAL.COM PROMPTS")
    print("="*60)
    
    for practitioner, pathway_id in PATHWAYS.items():
        update_pathway_scheduling_prompts(practitioner, pathway_id)
    
    print("\n" + "="*60)
    print("DONE! Scheduling nodes updated with Cal.com tool instructions.")
    print("="*60)
