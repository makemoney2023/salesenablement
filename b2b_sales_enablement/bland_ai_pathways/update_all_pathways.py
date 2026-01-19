import json
import subprocess
import os

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

# Load knowledge base content
with open('superpatch_knowledge_base.txt', 'r') as f:
    KB_CONTENT = f.read()

# Pathway IDs for each practitioner
PATHWAYS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage Therapists": "d202aad7-bcb6-478c-a211-b00877545e05",
    "Naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "Integrative Medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "Functional Medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "Acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

# Practitioner-specific context
PRACTITIONER_CONTEXT = {
    "Chiropractors": {
        "short": "DCs",
        "specialty": "spinal adjustments and non-invasive care",
        "patient_focus": "back pain, neck pain, and musculoskeletal issues",
        "value_prop": "drug-free solutions to support patients between adjustments",
        "key_products": ["Freedom (pain)", "Liberty (balance)", "REM (sleep)"],
        "clinical_hook": "DCs are already committed to non-invasive care"
    },
    "Massage Therapists": {
        "short": "LMTs",
        "specialty": "soft tissue manipulation and relaxation therapy",
        "patient_focus": "muscle tension, stress, and recovery",
        "value_prop": "extend the benefits of massage between sessions",
        "key_products": ["Freedom (muscle recovery)", "Peace (stress)", "REM (sleep)"],
        "clinical_hook": "LMTs understand how touch affects the nervous system"
    },
    "Naturopaths": {
        "short": "NDs",
        "specialty": "natural and holistic medicine",
        "patient_focus": "whole-body wellness and natural solutions",
        "value_prop": "100% drug-free technology that works with the body naturally",
        "key_products": ["Freedom (pain)", "Defend (immune)", "REM (sleep)"],
        "clinical_hook": "NDs prioritize natural interventions over pharmaceuticals"
    },
    "Integrative Medicine": {
        "short": "integrative practitioners",
        "specialty": "combining conventional and complementary approaches",
        "patient_focus": "patients seeking comprehensive care options",
        "value_prop": "evidence-based complementary option to add to treatment protocols",
        "key_products": ["Freedom (pain)", "REM (sleep)", "Peace (stress)"],
        "clinical_hook": "Integrative practitioners value both evidence and patient preference"
    },
    "Functional Medicine": {
        "short": "functional medicine practitioners",
        "specialty": "root cause analysis and systems-based approach",
        "patient_focus": "patients with complex, chronic conditions",
        "value_prop": "non-invasive neural technology that supports body systems",
        "key_products": ["Freedom (pain)", "REM (sleep)", "Boost (energy)"],
        "clinical_hook": "Functional medicine looks at interconnected body systems"
    },
    "Acupuncturists": {
        "short": "LAcs",
        "specialty": "traditional Chinese medicine and meridian therapy",
        "patient_focus": "energy balance, pain, and holistic wellness",
        "value_prop": "VTT technology works with neural pathways, similar to acupuncture principles",
        "key_products": ["Freedom (pain)", "Peace (stress)", "Liberty (balance)"],
        "clinical_hook": "Acupuncturists already understand how stimulation affects neural pathways"
    }
}

def create_pathway_for_practitioner(practitioner_type):
    """Create a complete pathway with proper node types for a practitioner"""
    ctx = PRACTITIONER_CONTEXT[practitioner_type]
    
    nodes = [
        # Node 1: Introduction - Default type with AI prompt
        {
            "id": "1",
            "type": "Default",
            "data": {
                "name": "Introduction",
                "isStart": True,
                "prompt": f"""You are Jennifer, a friendly, professional sales representative for SuperPatch.

YOU ARE CALLING: A {practitioner_type.lower()} practice

YOUR GOAL: Introduce yourself and gauge interest in a brief conversation.

OPENING (adapt naturally): "Good morning, this is Jennifer with SuperPatch. I'm reaching out to {ctx['short']} who are looking for {ctx['value_prop']}. I know {ctx['clinical_hook']}, and I wanted to share a technology that's been clinically studied. Do you have two minutes?"

LISTEN FOR AND RESPOND TO:
- "I'm busy" → "No problem! When would be a better time for a quick call?"
- "What is SuperPatch?" → Briefly explain (route to Company Introduction)
- "Yes/Tell me more" → Great! Ask about their practice (route to Discovery)
- "Not interested" → Politely probe why (route to Soft No Handler)

TONE: Warm, respectful of their time, professional but not salesy."""
            }
        },
        
        # Node 2: Company Introduction - Default type
        {
            "id": "2",
            "type": "Default",
            "data": {
                "name": "Company Introduction",
                "prompt": f"""The prospect wants to know more about SuperPatch.

YOUR GOAL: Give a compelling but brief introduction tailored to {ctx['short']}.

KEY POINTS (in your own words):
- SuperPatch is a wellness technology company
- We create 100% drug-free patches using Vibrotactile Technology (VTT)
- VTT works by stimulating nerve receptors in the skin - similar to how mechanoreceptors work
- Based on Nobel Prize-winning research on Piezo channels
- {ctx['clinical_hook']}, so this fits naturally with your approach

IMPORTANT: Use the Knowledge Base if they ask specific questions about how VTT works or clinical studies.

AFTER EXPLAINING: "Would you like to hear how this could help your patients, or do you have specific questions?"

TONE: Knowledgeable but conversational. You're sharing, not lecturing."""
            }
        },
        
        # Node 3: Discovery Questions - Default type
        {
            "id": "3",
            "type": "Default",
            "data": {
                "name": "Discovery Questions",
                "prompt": f"""You've got their attention. Now learn about their practice.

YOUR GOAL: Understand their practice and patient challenges so you can tailor your presentation.

QUESTIONS TO ASK NATURALLY:
- "How long have you been in practice?"
- "What types of patients do you primarily see?"
- "What are the most common challenges your patients face between visits?"
- "How do your patients currently manage {ctx['patient_focus']} at home?"
- "Do you currently recommend or retail any wellness products?"

LISTEN FOR:
- Pain complaints → Recommend Freedom patch
- Sleep issues → Recommend REM patch
- Stress/anxiety → Recommend Peace patch
- Balance issues → Recommend Liberty patch
- Low energy → Recommend Boost patch

DON'T rush through questions. If they share something interesting, follow up!

WHEN YOU UNDERSTAND THEIR NEEDS: Transition to presenting relevant solutions."""
            }
        },
        
        # Node 4: Product Presentation - Default type
        {
            "id": "4",
            "type": "Default",
            "data": {
                "name": "Product Presentation",
                "prompt": f"""Time to present SuperPatch solutions based on what you learned.

YOUR GOAL: Connect SuperPatch benefits to their specific patient challenges.

STRUCTURE (P-A-S-E Framework):

1. PROBLEM: "From what you've shared, it sounds like [their challenge]..."

2. AGITATE: "That creates a frustrating cycle for patients - they feel great after treatment, but between visits..."

3. SOLVE: "That's where SuperPatch comes in. Based on what you described, I'd recommend:
   - {ctx['key_products'][0]}
   - {ctx['key_products'][1]}
   - {ctx['key_products'][2]}"

4. EXPAND with evidence:
   - Freedom: RESTORE study - peer-reviewed RCT showing pain reduction
   - REM: HARMONI study - 80% stopped sleep medications
   - Liberty: Balance study - 31% improvement in balance scores

IMPORTANT: Reference the Knowledge Base for accurate clinical data!

IF THEY'RE SKEPTICAL: Offer to share the research
IF THEY'RE INTERESTED: Move toward business model discussion"""
            }
        },
        
        # Node 5: Evidence Discussion - Default (could route to KB)
        {
            "id": "5",
            "type": "Default",
            "data": {
                "name": "Evidence Discussion",
                "prompt": """They want to see evidence. This is GOOD - they're taking you seriously!

YOUR GOAL: Present clinical evidence that validates SuperPatch.

REFERENCE THE KNOWLEDGE BASE for accurate study details:

FREEDOM PATCH (Pain):
- RESTORE Study - double-blind, placebo-controlled RCT
- Published in Pain Therapeutics journal
- 118 participants, 14 days
- ClinicalTrials.gov: NCT06505005
- Results: Significant pain reduction AND range of motion improvement

REM PATCH (Sleep):
- HARMONI Study
- 113 participants
- 46% faster sleep onset
- 80% stopped using sleep medications

LIBERTY PATCH (Balance):
- Balance Study
- 31% improvement in balance scores (p<0.05)

OFFER: "I can send you the full study abstracts - what's your email?"

TONE: Confident. You have real, peer-reviewed evidence."""
            }
        },
        
        # Node 6: Objection Handler - Default type
        {
            "id": "6",
            "type": "Default",
            "data": {
                "name": "Objection Handler",
                "prompt": """Handle their concern professionally, then re-engage.

COMMON OBJECTIONS:

"I need to see the research first"
→ "Absolutely! The RESTORE study is a peer-reviewed RCT in Pain Therapeutics. I'll send you the abstracts. What email should I use?"

"My patients won't believe in a patch"
→ "They don't need to believe - just experience it. Many practitioners start by trying it themselves. Would you like a sample?"

"I already recommend supplements/products"
→ "That's great - SuperPatch is a different category. It works through neural pathways, not chemistry. Many practitioners use both. Which patients might benefit from an additional option?"

"It's too expensive"
→ "At about $3/day, it's comparable to daily supplements. And unlike pain medications, there's no tolerance buildup. What's the value of avoiding pharmaceutical side effects?"

"I'd need to try it myself"
→ "Absolutely! That's what we recommend. I can send you a sample pack. Which would be most relevant for you?"

APPROACH: Acknowledge → Address → Re-engage with a question

TONE: Never defensive. Their concerns are valid."""
            }
        },
        
        # Node 7: Business Model - Default type
        {
            "id": "7",
            "type": "Default",
            "data": {
                "name": "Business Model Discussion",
                "prompt": """They're interested! Time to discuss partnership options.

YOUR GOAL: Present options and help them choose what fits their practice.

THREE OPTIONS:

WHOLESALE (25% Discount):
- Purchase at 25% off retail
- Retail directly to patients
- Full control over pricing
- Best for: Practices already retailing products

AFFILIATE PROGRAM:
- We give you a unique referral link
- Patients order directly from us
- You earn commission on every sale
- No inventory to manage
- Best for: Those who prefer not to handle retail

HYBRID:
- Stock key products (Freedom, REM) for immediate patient needs
- Use affiliate for the full product line
- Best of both worlds

ASK: "Which of these would fit best with how you run your practice?"

Their answer tells you how to proceed to close."""
            }
        },
        
        # Node 8: Close - Default type
        {
            "id": "8",
            "type": "Default",
            "data": {
                "name": "Close",
                "prompt": """They're ready. Time to close!

CLOSING APPROACHES:

Assumptive: "Most practitioners start with our Starter Kit - should I set you up with that?"

Alternative: "Would you prefer just Freedom patches to start, or the full portfolio?"

Summary: "Based on what you've shared about your [pain/sleep/stress] patients, the [product] would be perfect. Ready to get started?"

IF THEY SAY YES:
- Confirm what they want
- Get shipping address
- Get email for confirmation
- Explain next steps: "You'll receive confirmation today, and your kit ships within 24 hours."

IF THEY NEED MORE TIME:
- "I understand. Let me send you the information and we can chat again in a few days. What's your email?"
- Schedule follow-up

TONE: Confident but not pushy. Make it easy to say yes."""
            }
        },
        
        # Node 9: Follow Up Setup - Default type
        {
            "id": "9",
            "type": "Default",
            "data": {
                "name": "Follow Up Setup",
                "prompt": """They're interested but need time. That's okay!

YOUR GOAL: Schedule a follow-up and send information.

SAY: "I completely understand - it's an important decision. Let me send you our practitioner packet with study summaries and product info."

CAPTURE:
- Best email address
- Good day/time for follow-up call
- Any specific questions they want addressed

CONFIRM: Read back the details - "So I'll send info to [email] and call you [day/time]. Sound good?"

TONE: Patient, helpful, no pressure. Getting a follow-up scheduled is a win!"""
            }
        },
        
        # Node 10: Schedule Callback - Wait for Response type
        {
            "id": "10",
            "type": "Wait for Response",
            "data": {
                "name": "Schedule Callback",
                "prompt": """They're busy right now.

YOUR GOAL: Find a better time.

SAY: "No problem at all - I know you're busy. When would be better for a quick 10-minute call?"

OFFER OPTIONS:
- "Would later this week work?"
- "What time do you typically have a few minutes between patients?"
- "Morning or afternoon?"

WAIT for their response - they may need a moment to check their calendar.

CONFIRM: "Great, I've got you down for [day/time]. I'll give you a call then."

TONE: Respectful, flexible."""
            }
        },
        
        # Node 11: Soft No Handler - Default type
        {
            "id": "11",
            "type": "Default",
            "data": {
                "name": "Soft No Handler",
                "prompt": """They've said no. Don't give up immediately, but be respectful.

YOUR GOAL: Understand why and leave the door open.

IF "I'M NOT INTERESTED":
"I understand - you must get a lot of calls. Just so I know, is it that you don't see a need for drug-free patient support, or is the timing not right?"

IF THEY ASK TO BE REMOVED:
"Of course. Before I go - would you prefer I just email you some information to review when convenient?"

IF FIRM NO:
"I understand completely. If anything changes, feel free to visit superpatch.com. Thanks for your time, have a great day!"

BASED ON RESPONSE:
- If they soften → try to capture email or schedule callback
- If firm → thank them and end politely

TONE: Never pushy. Leave a good impression."""
            }
        },
        
        # Node 12: End Call - End Call type
        {
            "id": "12",
            "type": "End Call",
            "data": {
                "name": "End Call",
                "prompt": """Wrap up professionally based on outcome.

IF THEY ORDERED:
"Thank you so much! You'll receive confirmation shortly. If you have questions, feel free to reach out. Have a great day!"

IF FOLLOW-UP SCHEDULED:
"Perfect! I'll send that information right away and call you [day/time]. Thanks - talk soon!"

IF CALLBACK SCHEDULED:
"Great, I've got you down for [day/time]. Have a great day!"

IF NOT INTERESTED:
"Thanks for your time. If anything changes, visit superpatch.com. Have a great day!"

TONE: Warm, professional, grateful."""
            }
        },
        
        # Node KB: Knowledge Base - Knowledge Base type
        {
            "id": "kb",
            "type": "Knowledge Base",
            "data": {
                "name": "SuperPatch Knowledge Base",
                "prompt": "Search this knowledge base when the user asks specific questions about SuperPatch products, clinical studies, how VTT technology works, pricing, or business models. Always provide accurate information from this source.",
                "knowledge_base": KB_CONTENT
            }
        }
    ]
    
    # Edges for conversation flow
    edges = [
        # From Introduction
        {"id": "e1", "source": "1", "target": "2", "data": {"label": "what is superpatch"}},
        {"id": "e2", "source": "1", "target": "3", "data": {"label": "interested"}},
        {"id": "e3", "source": "1", "target": "10", "data": {"label": "busy"}},
        {"id": "e4", "source": "1", "target": "11", "data": {"label": "not interested"}},
        
        # Company Intro flows
        {"id": "e5", "source": "2", "target": "3", "data": {"label": "continue"}},
        {"id": "e5b", "source": "2", "target": "kb", "data": {"label": "technical question"}},
        
        # Discovery flows
        {"id": "e6", "source": "3", "target": "4", "data": {"label": "ready to present"}},
        
        # Presentation flows
        {"id": "e7", "source": "4", "target": "5", "data": {"label": "wants evidence"}},
        {"id": "e8", "source": "4", "target": "6", "data": {"label": "has objection"}},
        {"id": "e9", "source": "4", "target": "7", "data": {"label": "interested in business"}},
        {"id": "e9b", "source": "4", "target": "kb", "data": {"label": "product question"}},
        
        # Evidence flows
        {"id": "e10", "source": "5", "target": "7", "data": {"label": "satisfied"}},
        {"id": "e10b", "source": "5", "target": "kb", "data": {"label": "more details"}},
        
        # Objection handling
        {"id": "e11", "source": "6", "target": "4", "data": {"label": "objection handled"}},
        {"id": "e11b", "source": "6", "target": "11", "data": {"label": "firm no"}},
        
        # Business model flows
        {"id": "e12", "source": "7", "target": "8", "data": {"label": "ready to close"}},
        
        # Close flows
        {"id": "e13", "source": "8", "target": "12", "data": {"label": "success"}},
        {"id": "e14", "source": "8", "target": "9", "data": {"label": "needs time"}},
        
        # Follow up flows
        {"id": "e15", "source": "9", "target": "12", "data": {"label": "scheduled"}},
        
        # Callback flows
        {"id": "e16", "source": "10", "target": "12", "data": {"label": "callback set"}},
        
        # No handler flows
        {"id": "e17", "source": "11", "target": "12", "data": {"label": "end"}},
        {"id": "e17b", "source": "11", "target": "9", "data": {"label": "softened"}},
        
        # KB returns
        {"id": "e_kb1", "source": "kb", "target": "4", "data": {"label": "return"}}
    ]
    
    return {
        "name": f"SuperPatch - {practitioner_type} Sales",
        "description": f"Outbound sales pathway for {practitioner_type}",
        "nodes": nodes,
        "edges": edges
    }


def deploy_pathway(practitioner_type, pathway_id):
    """Deploy a pathway using curl"""
    payload = create_pathway_for_practitioner(practitioner_type)
    
    # Save payload to file
    filename = f"{practitioner_type.replace(' ', '_')}_pathway.json"
    with open(filename, 'w') as f:
        json.dump(payload, f, indent=2)
    
    print(f"\n{'='*50}")
    print(f"Deploying: {practitioner_type}")
    print(f"Pathway ID: {pathway_id}")
    print(f"Nodes: {len(payload['nodes'])} (including KB)")
    print(f"Edges: {len(payload['edges'])}")
    
    # Deploy main pathway
    cmd1 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "Content-Type: application/json" \
      -H "authorization: {API_KEY}" \
      -d @{filename}'''
    result1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    # Deploy to version 1
    cmd2 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" \
      -H "Content-Type: application/json" \
      -H "authorization: {API_KEY}" \
      -d @{filename}'''
    result2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    # Check results
    try:
        r1 = json.loads(result1.stdout)
        r2 = json.loads(result2.stdout)
        print(f"Main: {r1.get('status', 'error')}")
        print(f"V1: {r2.get('status', 'error')}")
        return r1.get('status') == 'success' and r2.get('status') == 'success'
    except:
        print(f"Error: {result1.stdout[:100]}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("UPDATING ALL PRACTITIONER PATHWAYS")
    print("=" * 60)
    print("\nNode types used:")
    print("  - Default: For AI-driven conversation")
    print("  - Wait for Response: For scheduling callbacks")
    print("  - End Call: For ending calls")
    print("  - Knowledge Base: For accurate product info")
    print("\nAll nodes use 'prompt' (not 'text') to avoid static text mode")
    
    results = {}
    for practitioner, pathway_id in PATHWAYS.items():
        success = deploy_pathway(practitioner, pathway_id)
        results[practitioner] = success
    
    print("\n" + "=" * 60)
    print("DEPLOYMENT SUMMARY")
    print("=" * 60)
    for p, success in results.items():
        status = "✅ Success" if success else "❌ Failed"
        print(f"  {p}: {status}")
