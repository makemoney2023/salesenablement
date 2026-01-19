import json
import subprocess

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255"

# Key facts to embed in prompts
KEY_FACTS = """
KEY SUPERPATCH FACTS (use these for accurate information):

COMPANY: SuperPatch - drug-free wellness patches using Vibrotactile Technology (VTT)

HOW IT WORKS: VTT stimulates mechanoreceptors in the skin (based on Nobel Prize-winning research on Piezo channels). No drugs absorbed - works through neural pathways. Like "Braille for your body."

CLINICAL STUDIES:
- FREEDOM (Pain): RESTORE Study, NCT06505005, 118 participants, significant pain reduction + ROM improvement
- REM (Sleep): HARMONI Study, 80% stopped sleep meds, 46% faster sleep onset
- LIBERTY (Balance): 31% improvement in balance scores (p<0.05)

PRODUCTS: Freedom (pain), REM (sleep), Liberty (balance), Victory (performance), Focus (concentration), Ignite (metabolism), Kick It (willpower), Defend (immune), Joy (mood), Lumi (beauty), Rocket (men's), Peace (stress), Boost (energy)

PRICING: ~$3/day, comparable to supplements

BUSINESS MODELS:
- Wholesale: 25% discount, retail to patients
- Affiliate: Referral link, commission, no inventory
- Hybrid: Stock key products + affiliate for rest
"""

PATHWAYS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage Therapists": "d202aad7-bcb6-478c-a211-b00877545e05",
    "Naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "Integrative Medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "Functional Medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "Acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

PRACTITIONER_CONTEXT = {
    "Chiropractors": {"short": "DCs", "focus": "pain between adjustments", "products": "Freedom, Liberty, REM"},
    "Massage Therapists": {"short": "LMTs", "focus": "extending massage benefits", "products": "Freedom, Peace, REM"},
    "Naturopaths": {"short": "NDs", "focus": "natural wellness", "products": "Freedom, Defend, REM"},
    "Integrative Medicine": {"short": "integrative practitioners", "focus": "complementary options", "products": "Freedom, REM, Peace"},
    "Functional Medicine": {"short": "functional medicine practitioners", "focus": "systems-based wellness", "products": "Freedom, REM, Boost"},
    "Acupuncturists": {"short": "LAcs", "focus": "neural pathway support", "products": "Freedom, Peace, Liberty"},
}

def create_pathway(practitioner):
    ctx = PRACTITIONER_CONTEXT[practitioner]
    
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

OPENING: "Hi, this is Jennifer with SuperPatch. I'm reaching out to {ctx['short']} looking for drug-free solutions for {ctx['focus']}. Do you have 2 minutes?"

RESPOND TO:
- Busy → Ask for better time
- What's SuperPatch → Brief explanation
- Interested → Move to discovery
- Not interested → Politely probe why"""
            }
        },
        {
            "id": "2",
            "type": "Default",
            "data": {
                "name": "Discovery",
                "prompt": f"""Learn about their practice to tailor your pitch.

{KEY_FACTS}

ASK ABOUT:
- Practice focus and patient types
- Common patient challenges between visits
- Current products they recommend

LISTEN FOR needs that match: {ctx['products']}"""
            }
        },
        {
            "id": "3",
            "type": "Default",
            "data": {
                "name": "Product Presentation",
                "prompt": f"""Present SuperPatch solutions based on their needs.

{KEY_FACTS}

RECOMMENDED PRODUCTS FOR {practitioner.upper()}: {ctx['products']}

STRUCTURE:
1. Acknowledge their challenge
2. Introduce SuperPatch as solution
3. Mention clinical evidence
4. Ask if they want more details"""
            }
        },
        {
            "id": "4",
            "type": "Default",
            "data": {
                "name": "Evidence & Objections",
                "prompt": f"""Handle questions about evidence or concerns.

{KEY_FACTS}

EVIDENCE TO CITE:
- Freedom: RESTORE Study (NCT06505005) - peer-reviewed RCT
- REM: HARMONI Study - 80% stopped sleep meds
- Liberty: Balance Study - 31% improvement

OBJECTION RESPONSES:
- "Need research" → Offer to send study abstracts
- "Patients won't believe" → They just need to try it
- "Too expensive" → $3/day, no tolerance buildup
- "Already have products" → Different category, many use both"""
            }
        },
        {
            "id": "5",
            "type": "Default",
            "data": {
                "name": "Business Model",
                "prompt": f"""Present partnership options.

{KEY_FACTS}

THREE OPTIONS:
1. WHOLESALE (25% off) - retail to patients directly
2. AFFILIATE - referral link, commission, no inventory
3. HYBRID - stock key products + affiliate

ASK: "Which fits your practice best?" """
            }
        },
        {
            "id": "6",
            "type": "Default",
            "data": {
                "name": "Close",
                "prompt": f"""Close the sale.

{KEY_FACTS}

APPROACHES:
- "Most start with Starter Kit - should I set you up?"
- "Would you prefer just Freedom or the full portfolio?"

IF YES: Confirm order, get shipping, get email
IF NEEDS TIME: Schedule follow-up, offer to send info"""
            }
        },
        {
            "id": "7",
            "type": "Wait for Response",
            "data": {
                "name": "Schedule Callback",
                "prompt": """They're busy. Find a better time.

SAY: "No problem - when's a better time for a quick call?"

Get day/time and confirm."""
            }
        },
        {
            "id": "8",
            "type": "Default",
            "data": {
                "name": "Handle No",
                "prompt": """They said no. Be respectful but probe.

SAY: "I understand. Is it that you don't need drug-free options, or is timing not right?"

IF SOFTENS: Try for email or callback
IF FIRM: Thank them politely"""
            }
        },
        {
            "id": "9",
            "type": "End Call",
            "data": {
                "name": "End Call",
                "prompt": """Wrap up professionally.

IF ORDERED: "Thank you! Confirmation coming shortly."
IF FOLLOW-UP: "I'll send info and call you [day/time]."
IF NO: "Thanks for your time. Visit superpatch.com if interested."""
            }
        }
    ]
    
    edges = [
        {"id": "e1", "source": "1", "target": "2", "data": {"label": "interested"}},
        {"id": "e2", "source": "1", "target": "7", "data": {"label": "busy"}},
        {"id": "e3", "source": "1", "target": "8", "data": {"label": "not interested"}},
        {"id": "e4", "source": "2", "target": "3", "data": {"label": "continue"}},
        {"id": "e5", "source": "3", "target": "4", "data": {"label": "questions"}},
        {"id": "e6", "source": "3", "target": "5", "data": {"label": "interested"}},
        {"id": "e7", "source": "4", "target": "5", "data": {"label": "satisfied"}},
        {"id": "e8", "source": "5", "target": "6", "data": {"label": "ready"}},
        {"id": "e9", "source": "6", "target": "9", "data": {"label": "done"}},
        {"id": "e10", "source": "7", "target": "9", "data": {"label": "scheduled"}},
        {"id": "e11", "source": "8", "target": "9", "data": {"label": "end"}}
    ]
    
    return {
        "name": f"SuperPatch - {practitioner} Sales",
        "description": f"Sales pathway for {practitioner}. KB: {KB_ID}",
        "nodes": nodes,
        "edges": edges
    }

def deploy(practitioner, pathway_id):
    payload = create_pathway(practitioner)
    filename = f"{practitioner.replace(' ', '_')}_v2.json"
    
    with open(filename, 'w') as f:
        json.dump(payload, f, indent=2)
    
    print(f"\n{'='*40}")
    print(f"Deploying: {practitioner}")
    
    # Main pathway
    cmd1 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    # Version 1
    cmd2 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{filename}'
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    try:
        s1 = json.loads(r1.stdout).get('status', 'error')
        s2 = json.loads(r2.stdout).get('status', 'error')
        print(f"Main: {s1}, V1: {s2}")
        return s1 == 'success' and s2 == 'success'
    except:
        print(f"Error: {r1.stdout[:100]}")
        return False

if __name__ == "__main__":
    print("Updating all pathways WITHOUT Knowledge Base node type")
    print("Key facts embedded directly in prompts")
    
    for p, pid in PATHWAYS.items():
        deploy(p, pid)
    
    print("\n" + "="*40)
    print("DONE - All pathways updated")
    print(f"KB ID for reference: {KB_ID}")
