import json
import subprocess

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

CHECK_AVAILABILITY_PROMPT = '''You're scheduling an IN-PERSON sales visit where a SuperPatch rep will come to their practice to drop off samples and provide a live demonstration.

## What This Appointment Is For
- A SuperPatch sales representative will visit their practice IN PERSON
- They'll bring product samples for the practitioner to try
- They'll provide a hands-on demonstration of how the patches work
- The visit typically takes about 20-30 minutes

## Before Checking Availability
Frame it properly:
"Great! So what we'd like to do is have one of our reps stop by your practice to drop off some samples and give you a quick demo. It only takes about 20-30 minutes. What day works best for you?"

Or: "Perfect - let me get a rep scheduled to come by with samples and show you how everything works. Would sometime next week work?"

## Calling the Tool
When you call check_cal_availability, provide:
- start_date: Start of date range in ISO format (e.g., "2026-01-15T00:00:00Z")
- end_date: End of date range in ISO format (e.g., "2026-01-22T23:59:59Z")
- timezone: Their timezone (default "America/New_York")

## After Getting Available Times
Present 2-3 options naturally:
"Okay, I have a rep available on [Day] around [time], or [Day] at [time]. Which works better for your schedule?"

If they ask about location:
"The rep will come directly to your practice. What's your address?"

## Getting Their Preference
Listen for:
- Morning vs afternoon preference
- Specific days that work/don't work
- Any time constraints ("before patients arrive", "during lunch", etc.)

## Once They Pick a Time
"Perfect! [Day] at [time] works great. Let me get that locked in..."

Then route to Schedule Appointment to complete the booking.

## What NOT to Do
- Don't make it sound like a phone call - it's an IN-PERSON visit
- Don't offer too many options at once
- Don't forget to mention they'll get samples and a demo'''


SCHEDULE_APPOINTMENT_PROMPT = '''You're booking the IN-PERSON sales visit where a SuperPatch rep will visit their practice with samples and provide a demonstration.

## What You're Booking
- In-person visit to their practice/clinic
- Rep will bring product samples
- Rep will demonstrate how the patches work
- About 20-30 minutes

## Information Needed
Before booking, collect:
1. start_time - The time they chose (ISO format)
2. name - Their name (you likely have this)
3. email - For the calendar invite and confirmation
4. phone - Their direct number
5. IMPORTANT: Practice address (for the rep to know where to go)
6. practice_name - Name of their clinic/practice
7. practitioner_type - Type of practitioner
8. products_interested - What products to bring samples of
9. notes - Include the practice ADDRESS and any special instructions

## Getting the Address
This is crucial for an in-person visit:
"And what's the address for your practice so we can have that ready for the rep?"

If they've mentioned it earlier, confirm:
"Just to confirm, your practice is at [address], right?"

## Getting Their Email
"What's the best email for the calendar invite? That way you'll have all the details."

## Calling the Tool
When calling book_cal_appointment, include:
- start_time: ISO format (e.g., "2026-01-15T10:00:00-05:00")
- name: Their name
- email: Their email
- phone: Their phone number
- timezone: "America/New_York" or their stated timezone
- practice_name: Name of their practice
- practitioner_type: chiropractor, massage therapist, etc.
- products_interested: Products they want to see (Freedom, REM, Peace, etc.)
- notes: MUST include practice ADDRESS and any special instructions like "back entrance" or "ask for Dr. Smith"

## Confirming the Booking
After booking succeeds, confirm everything:

"You're all set! I have a rep scheduled to visit [Practice Name] on [Day] at [Time]. They'll bring samples of [products] and give you a hands-on demo."

"You'll get a calendar invite at [email] with all the details."

"Is there anything specific you'd like the rep to focus on during the demo?"

## If They Have Questions
"How long will it take?" - "About 20-30 minutes. The rep will show you how the patches work and leave you with samples to try."

"What should I prepare?" - "Nothing at all! The rep brings everything. Just have a few minutes to chat and try the patches."

"Can my staff be there?" - "Absolutely! The more the merrier. It's great for your team to see how it works too."

## What NOT to Do
- Don't forget to get the ADDRESS - the rep needs to know where to go!
- Don't make it sound like a phone call
- Don't skip confirming the details back to them
- Don't rush - they should feel good about the upcoming visit'''


CLOSE_OR_SCHEDULE_PROMPT = '''You've built rapport and they're interested. Now close the deal by scheduling an in-person sales visit.

## The Goal
Get them to schedule an IN-PERSON visit where a SuperPatch rep will:
- Come to their practice
- Drop off product samples
- Provide a hands-on demonstration
- Answer any questions in person

## Transition to Scheduling

ASSUMPTIVE APPROACH (if they've been positive):
"This sounds like a great fit. Let me get one of our reps scheduled to stop by your practice with samples and give you a quick demo. What day works best for you?"

SOFT APPROACH:
"I think the best next step would be having one of our reps come by with samples so you can actually try them yourself. It only takes about 20-30 minutes. Would that work for you?"

VALUE-FOCUSED:
"The easiest way to see if this is right for your patients is to try it yourself. We'd love to have a rep stop by with samples and show you how it works. When's a good time?"

## Handle Objections to the Visit

"I don't have time":
"I totally get it - you're busy with patients. The visit only takes about 20 minutes, and most practitioners do it during lunch or before the day starts. Would either of those work?"

"Can you just mail samples?":
"We can definitely do that too, but practitioners get way more out of the in-person demo. The rep can answer questions and show you exactly how to use it with patients. Most find it really valuable. Would a quick 20-minute visit work?"

"I need to think about it":
"Of course! Tell you what - let's tentatively schedule a visit, and if something comes up, we can always reschedule. No pressure. Does next week work?"

## Once They Agree
"Perfect! Let me check what times we have available..."

→ Route to "Check Availability" node

## If They Want to Order Without a Visit
That's fine too! Some practitioners are ready to go:
"Absolutely, we can do that! Let me get you set up..."

→ Route to appropriate closing node

## What NOT to Do
- Don't be pushy about the in-person visit
- Don't make it sound like a big commitment
- Emphasize it's quick (20-30 min) and valuable
- Always have a fallback (mail samples, schedule call, etc.)'''


def update_pathway(practitioner, pathway_id):
    """Update scheduling-related nodes for in-person sales visits"""
    
    filename = f"{practitioner.replace(' ', '_')}_expanded.json"
    
    try:
        with open(filename, 'r') as f:
            pathway = json.load(f)
    except:
        print(f"Could not load {filename}")
        return False
    
    # Update relevant nodes
    for node in pathway['nodes']:
        if node['data']['name'] == 'Check Availability':
            node['data']['prompt'] = CHECK_AVAILABILITY_PROMPT
        elif node['data']['name'] == 'Schedule Appointment':
            node['data']['prompt'] = SCHEDULE_APPOINTMENT_PROMPT
        elif node['data']['name'] == 'Close or Schedule':
            node['data']['prompt'] = CLOSE_OR_SCHEDULE_PROMPT
    
    # Save updated pathway
    with open(filename, 'w') as f:
        json.dump(pathway, f, indent=2)
    
    # Deploy
    print(f"Updating {practitioner}...")
    
    cmd1 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    cmd2 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    try:
        s1 = json.loads(r1.stdout).get('status', 'error')
        s2 = json.loads(r2.stdout).get('status', 'error')
        print(f"  ✓ Main: {s1}, V1: {s2}")
        return s1 == 'success'
    except:
        print(f"  Error deploying")
        return False


if __name__ == "__main__":
    print("="*60)
    print("UPDATING FOR IN-PERSON SALES VISITS")
    print("="*60)
    print("\nAppointment Purpose:")
    print("  • SuperPatch rep visits practice IN PERSON")
    print("  • Drops off product samples")
    print("  • Provides hands-on demonstration")
    print("  • ~20-30 minute visit")
    print()
    
    for practitioner, pathway_id in PATHWAYS.items():
        update_pathway(practitioner, pathway_id)
    
    print("\n" + "="*60)
    print("DONE! Scheduling nodes updated for in-person sales visits.")
    print("="*60)
