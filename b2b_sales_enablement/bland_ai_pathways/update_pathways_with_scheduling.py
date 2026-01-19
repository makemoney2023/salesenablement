import json
import subprocess

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255"
CHECK_AVAIL_TOOL = "TL-79a3c232-ca51-4244-b5d2-21f4e70fd872"
SCHEDULE_TOOL = "TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526"

KEY_FACTS = """
KEY SUPERPATCH FACTS:
- Drug-free patches using Vibrotactile Technology (VTT)
- FREEDOM (pain): RESTORE Study NCT06505005
- REM (sleep): HARMONI Study, 80% stopped sleep meds
- LIBERTY (balance): 31% improvement
- Pricing: ~$3/day
- Business: Wholesale 25% off, Affiliate, or Hybrid
"""

PATHWAYS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage Therapists": "d202aad7-bcb6-478c-a211-b00877545e05",
    "Naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "Integrative Medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "Functional Medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "Acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

def create_pathway(practitioner):
    nodes = [
        {
            "id": "1",
            "type": "Default",
            "data": {
                "name": "Introduction",
                "isStart": True,
                "prompt": f"""You are Jennifer, a sales rep for SuperPatch calling {practitioner.lower()}.
{KEY_FACTS}
GOAL: Introduce yourself and gauge interest.
OPENING: "Hi, this is Jennifer with SuperPatch. I'm reaching out about drug-free solutions for your patients. Do you have 2 minutes?"
"""
            }
        },
        {
            "id": "2",
            "type": "Default",
            "data": {
                "name": "Discovery",
                "prompt": f"""Learn about their practice.
{KEY_FACTS}
ASK: Practice focus, patient challenges, current products they recommend."""
            }
        },
        {
            "id": "3",
            "type": "Default",
            "data": {
                "name": "Product Presentation",
                "prompt": f"""Present SuperPatch solutions.
{KEY_FACTS}
Connect their needs to products. Mention clinical evidence."""
            }
        },
        {
            "id": "4",
            "type": "Default",
            "data": {
                "name": "Handle Objections",
                "prompt": f"""Handle concerns professionally.
{KEY_FACTS}
- "Need research" → Offer study abstracts
- "Too expensive" → $3/day, no tolerance
- "Patients skeptical" → They just need to try it"""
            }
        },
        {
            "id": "5",
            "type": "Default",
            "data": {
                "name": "Business Model",
                "prompt": """Present partnership options:
1. WHOLESALE - 25% discount, retail to patients
2. AFFILIATE - Referral link, commission, no inventory
3. HYBRID - Stock key products + affiliate
Ask: "Which fits your practice?" """
            }
        },
        {
            "id": "6",
            "type": "Default",
            "data": {
                "name": "Close or Schedule Follow-Up",
                "prompt": """Based on interest level:

IF READY TO ORDER:
"Great! Let me get you started with our Starter Kit."

IF NEEDS MORE INFO/TIME:
"I understand. Let me schedule a follow-up call to answer any questions. What day works best for you - this week or next week?"

CAPTURE: Their name, practice name, email, and preferred callback time.
Once they give a preferred time, use the check_availability tool to find open slots."""
            }
        },
        {
            "id": "7",
            "type": "Webhook",
            "data": {
                "name": "Check Availability",
                "prompt": """Use the check_availability tool to find open appointment slots.

Ask: "Would this week or next week work better for a follow-up call?"

After they respond, call the tool with their preference.
Present 2-3 options from the available times.""",
                "tool": CHECK_AVAIL_TOOL
            }
        },
        {
            "id": "8",
            "type": "Webhook",
            "data": {
                "name": "Schedule Appointment",
                "prompt": """Once they choose a time, use the schedule_appointment tool.

COLLECT (if not already gathered):
- Their name
- Practice/clinic name
- Email address
- Phone number (you have this from the call)
- Products they're interested in
- Any notes from the conversation

Confirm: "I've got you down for [day] at [time]. You'll receive a confirmation email."
Read back the confirmation number.""",
                "tool": SCHEDULE_TOOL
            }
        },
        {
            "id": "9",
            "type": "Wait for Response",
            "data": {
                "name": "Schedule Callback",
                "prompt": """They're busy now. Find a better time.
"When would be a better time for a quick call?"
Get day/time preference, then route to Check Availability."""
            }
        },
        {
            "id": "10",
            "type": "Default",
            "data": {
                "name": "Handle No",
                "prompt": """They said no. Be respectful.
"I understand. Is it the timing or you don't need drug-free options?"
IF SOFTENS: Try for email or callback
IF FIRM: Thank them politely"""
            }
        },
        {
            "id": "11",
            "type": "End Call",
            "data": {
                "name": "End Call",
                "prompt": """Wrap up professionally.
IF ORDERED: "Thank you! Confirmation coming shortly."
IF APPOINTMENT SET: "Looking forward to speaking with you on [date]. Have a great day!"
IF NO: "Thanks for your time. Visit superpatch.com if interested." """
            }
        }
    ]
    
    edges = [
        # Introduction flows
        {"id": "e1", "source": "1", "target": "2", "data": {"label": "interested"}},
        {"id": "e2", "source": "1", "target": "9", "data": {"label": "busy"}},
        {"id": "e3", "source": "1", "target": "10", "data": {"label": "not interested"}},
        
        # Discovery → Presentation
        {"id": "e4", "source": "2", "target": "3", "data": {"label": "continue"}},
        
        # Presentation flows
        {"id": "e5", "source": "3", "target": "4", "data": {"label": "has questions"}},
        {"id": "e6", "source": "3", "target": "5", "data": {"label": "interested"}},
        
        # Objection handling
        {"id": "e7", "source": "4", "target": "5", "data": {"label": "satisfied"}},
        {"id": "e8", "source": "4", "target": "10", "data": {"label": "firm no"}},
        
        # Business model → Close/Schedule
        {"id": "e9", "source": "5", "target": "6", "data": {"label": "continue"}},
        
        # Close flows
        {"id": "e10", "source": "6", "target": "7", "data": {"label": "schedule follow-up"}},
        {"id": "e11", "source": "6", "target": "11", "data": {"label": "order placed"}},
        
        # Availability → Schedule
        {"id": "e12", "source": "7", "target": "8", "data": {"label": "time selected"}},
        
        # Schedule → End
        {"id": "e13", "source": "8", "target": "11", "data": {"label": "confirmed"}},
        
        # Callback → Availability
        {"id": "e14", "source": "9", "target": "7", "data": {"label": "got preference"}},
        {"id": "e15", "source": "9", "target": "11", "data": {"label": "will call back"}},
        
        # No handler
        {"id": "e16", "source": "10", "target": "7", "data": {"label": "wants follow-up"}},
        {"id": "e17", "source": "10", "target": "11", "data": {"label": "end"}}
    ]
    
    return {
        "name": f"SuperPatch - {practitioner} Sales",
        "description": f"Sales pathway for {practitioner} with scheduling. KB: {KB_ID}",
        "nodes": nodes,
        "edges": edges
    }

def deploy(practitioner, pathway_id):
    payload = create_pathway(practitioner)
    filename = f"{practitioner.replace(' ', '_')}_with_scheduling.json"
    
    with open(filename, 'w') as f:
        json.dump(payload, f, indent=2)
    
    print(f"\n{'='*40}")
    print(f"Deploying: {practitioner}")
    
    cmd1 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    cmd2 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    try:
        s1 = json.loads(r1.stdout).get('status', 'error')
        s2 = json.loads(r2.stdout).get('status', 'error')
        print(f"Main: {s1}, V1: {s2}")
        return s1 == 'success' and s2 == 'success'
    except:
        print(f"Error: {r1.stdout[:200]}")
        return False

if __name__ == "__main__":
    print("Updating pathways WITH SCHEDULING")
    print(f"Check Availability Tool: {CHECK_AVAIL_TOOL}")
    print(f"Schedule Appointment Tool: {SCHEDULE_TOOL}")
    
    for p, pid in PATHWAYS.items():
        deploy(p, pid)
    
    print("\n" + "="*40)
    print("DONE - All pathways updated with scheduling")
