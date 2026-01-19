"""
Update existing expanded pathways by injecting practitioner-specific context into prompts.
This preserves the full 34-node structure while making each pathway unique.
"""

import json
import subprocess
import re

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

# ================================================================
# PRACTITIONER-SPECIFIC CONTEXT TO INJECT
# ================================================================

PRACTITIONER_CONTEXTS = {
    "Chiropractors": {
        "type_abbrev": "DC",
        "type_full": "chiropractor",
        "type_plural": "chiropractors",
        "practice_type": "chiropractic practice",
        
        "philosophy": "You understand DCs focus on the spine-nervous system relationship, believing proper alignment enables innate healing. They favor non-invasive, drug-free interventions.",
        
        "opening_script": """Hi, this is Jennifer with SuperPatch. I'm reaching out to chiropractors who are looking for drug-free solutions to support their patients between adjustments. I know DCs are already committed to non-invasive care, and I wanted to share a technology that's been clinically studied for pain relief. Do you have two minutes, or would scheduling a brief call work better?""",
        
        "key_hook": "support patients between adjustments so they don't lose progress",
        
        "patient_types": "back pain (acute and chronic), neck pain and tension headaches, sports injuries, auto accident rehab, seniors with mobility concerns, office workers with postural issues",
        
        "pain_points": """- Patients relapse between appointments
- Limited options for at-home pain management they can recommend
- Competing with pain medication for patient compliance
- Need adjunct therapies that enhance adjustment results
- Patients asking "What can I do at home?"
""",
        
        "why_superpatch_fits": "SuperPatch is perfect for DCs because it provides drug-free take-home support between adjustments. Patients feel great after an adjustment but within days they're reaching for NSAIDs or their tension builds back up. You can't follow them home - but SuperPatch can extend your work.",
        
        "top_products_context": {
            "Freedom": "For your back pain and sciatica patients - the RESTORE study showed pain reduction AND ROM improvement. Great between adjustments.",
            "REM": "For patients whose poor sleep is affecting their recovery. 46% faster sleep onset in the study.",
            "Liberty": "Perfect for your senior patients with balance concerns - 31% improvement in balance scores."
        },
        
        "discovery_questions_context": """When discovering their practice, ask questions relevant to DCs:
- "What's the most common complaint you hear from patients between their appointments?"
- "How do your patients typically manage discomfort at home after an adjustment?"
- "Do patients ever relapse or lose progress between visits? What do you think contributes to that?"
- "Do you currently retail any products - supplements, supports, wellness items?"
- "What would it mean if patients maintained 80% of their progress between visits instead of 50%?"
""",
        
        "objection_responses": {
            "how_is_this_different": """Great question! Traditional patches like Salonpas work through transdermal drug delivery - they put menthol or lidocaine into your body. SuperPatch uses Vibrotactile Technology - it doesn't deliver any substance. The ridge patterns stimulate mechanoreceptors in your skin, which then activate neural pathways. Completely different mechanism that aligns with your drug-free approach.""",
            "patients_wont_believe": """That's a fair concern. What we've found is that patients don't need to 'believe' - they just need to experience it. Many DCs start by trying it themselves, then on a few open-minded patients. Once patients feel the difference, the conversations get easier. Would you like to try a sample yourself first?""",
            "already_recommend_products": """Great - that means patients trust your recommendations. SuperPatch isn't competing with supplements; it's a different category. Supplements work internally through chemistry; VTT works externally through neural pathways. Many DCs use both."""
        },
        
        "closing_context": "Most DCs start with the Practitioner Starter Kit to try with a few back pain patients. Should I set that up so you can start offering drug-free take-home support this week?"
    },
    
    "Massage_Therapists": {
        "type_abbrev": "LMT",
        "type_full": "massage therapist",
        "type_plural": "massage therapists",
        "practice_type": "massage practice",
        
        "philosophy": "You understand massage therapists work hands-on to relieve tension, reduce pain, improve circulation, and promote relaxation. They understand the power of touch and manual therapy.",
        
        "opening_script": """Hi, this is Jennifer with SuperPatch. I'm reaching out because massage therapists understand something powerful - the impact of touch on the whole body. Our Vibrotactile Technology works through that same principle. Specialized patterns stimulate touch receptors in the skin, activating neural pathways for pain relief. It's like your work continues even after the client goes home. Sound interesting?""",
        
        "key_hook": "extend the benefits of your work to the other 23 hours when clients aren't on your table",
        
        "patient_types": "chronic pain and tension, stress and anxiety, athletes and active people, office workers with postural issues, injury recovery, relaxation seekers",
        
        "pain_points": """- Clients return with tension rebuilt between sessions
- Need products to extend treatment benefits
- Clients asking "What can I do at home?"
- Want to provide value beyond the table
- Looking for professional-grade products to retail
""",
        
        "why_superpatch_fits": "SuperPatch is perfect for LMTs because it extends your work when clients leave the table. You do incredible work during sessions, but within days the tension returns. Think of it as continuous, gentle touch therapy for the other 23 hours.",
        
        "top_products_context": {
            "Freedom": "For your pain clients - 'Wear this for the next few days to maintain your progress'",
            "Peace": "Maintains relaxation benefits - keeps that calm going at home",
            "REM": "Sleep support for recovery - better sleep means better results from your work"
        },
        
        "discovery_questions_context": """When discovering their practice, ask questions relevant to LMTs:
- "How quickly do clients report their tension or pain returning after a session?"
- "What do you currently recommend clients do at home to maintain benefits?"
- "Do clients ever ask for product recommendations?"
- "Do you currently sell any products - oils, creams, tools?"
- "Would you prefer to recommend products or have clients purchase elsewhere?"
""",
        
        "objection_responses": {
            "not_a_salesperson": """I totally get that - you became an LMT to help people, not to sell products. But think of it this way: when clients ask what they can do at home, you're providing a solution, not selling. It's completing their care. You probably already recommend stretches, right? This is just another tool.""",
            "clients_wont_spend_more": """That's a fair concern. Clients who value massage already understand investing in their wellness. At $3/day, it's less than their daily latte. And if it helps them maintain benefits longer, they might need fewer sessions - which saves them money.""",
            "different_from_menthol": """Great question! Menthol patches deliver a cooling substance through the skin. SuperPatch doesn't deliver anything - it's purely physical pattern stimulation. No smell, no chemicals, no mess. For clients who want truly drug-free, this is a different category."""
        },
        
        "closing_context": "After each session, just hand them a Freedom patch and say 'Wear this for the next few days to maintain your progress.' That's it. Should I set you up with a supply to start?"
    },
    
    "Naturopaths": {
        "type_abbrev": "ND",
        "type_full": "naturopathic doctor",
        "type_plural": "naturopaths",
        "practice_type": "naturopathic practice",
        
        "philosophy": "You understand NDs operate on six principles: First Do No Harm, Healing Power of Nature (Vis Medicatrix Naturae), Identify and Treat the Cause, Doctor as Teacher, Treat the Whole Person, and Prevention. They seek to stimulate the body's inherent self-healing using natural interventions.",
        
        "opening_script": """Good morning, this is Jennifer with SuperPatch. I'm reaching out to naturopathic doctors who are looking for drug-free technologies that work with the body's innate healing ability. We've developed Vibrotactile Technology that stimulates mechanoreceptors to activate neural pathways - essentially helping the body help itself. Does that align with what you look for in patient solutions?""",
        
        "key_hook": "works WITH the body's innate healing mechanisms, honors First Do No Harm",
        
        "patient_types": "chronic pain patients seeking alternatives, autoimmune and inflammation conditions, hormone imbalance and fatigue, digestive issues affecting absorption, detox participants, patients who have 'tried everything'",
        
        "pain_points": """- Patients on multiple supplements still struggling
- Need non-oral options for GI-sensitive patients
- Patients frustrated that "natural" takes longer to work
- Seeking technologies that work WITH the body, not just introduce substances
- Balancing symptom relief with root-cause treatment
""",
        
        "why_superpatch_fits": "SuperPatch aligns perfectly with naturopathic principles. It works WITH the body - nothing enters the system. It honors 'First Do No Harm.' And for patients with GI sensitivities or supplement fatigue, it's a non-oral option that doesn't require metabolism.",
        
        "top_products_context": {
            "Freedom": "Drug-free pain relief - works with the nervous system, not against it",
            "REM": "Sleep support without medications - 80% stopped sleep meds in the study",
            "Peace": "Stress and nervous system regulation - supports natural balance"
        },
        
        "discovery_questions_context": """When discovering their practice, ask questions relevant to NDs:
- "How do you typically approach symptom management while working on root causes?"
- "What percentage of patients come specifically seeking alternatives to medications?"
- "How do you address patients who have 'supplement fatigue' but still need support?"
- "Do you have patients who struggle with oral supplements due to GI issues?"
- "What would it mean to have a truly non-invasive option for pain patients?"
""",
        
        "objection_responses": {
            "need_to_understand_mechanism": """Absolutely - understanding mechanism is essential for NDs. The patches stimulate mechanoreceptors - Meissner's corpuscles and Merkel cells. This activates Piezo1 and Piezo2 ion channels, modulating neural signaling through Gate Control Theory. No chemical transduction - purely physical signal modulation. Want me to send the technical mechanism document?""",
            "patients_prefer_supplements": """Many do, and this isn't meant to replace those. But you likely have patients with GI sensitivities, or on too many supplements already. For those patients, this offers a non-oral option that doesn't require digestion or metabolism.""",
            "seems_too_simple": """I understand - but sometimes the most elegant solutions are simplest. Think about acupuncture or homeopathy - subtle mechanisms. VTT works through touch pathways your patients experience during hands-on therapies, just in a consistent, wearable form."""
        },
        
        "closing_context": "This aligns with your naturopathic principles - works with the body, honors First Do No Harm, nothing enters the system. Ready to try the Practitioner Kit?"
    },
    
    "Functional_Medicine": {
        "type_abbrev": "FM practitioner",
        "type_full": "functional medicine practitioner",
        "type_plural": "functional medicine practitioners",
        "practice_type": "functional medicine practice",
        
        "philosophy": "You understand functional medicine focuses on root causes through a systems biology approach. They look at the interconnected web of factors affecting health and create personalized treatment plans addressing underlying dysfunction.",
        
        "opening_script": """Hi, this is Jennifer with SuperPatch. I'm reaching out to functional medicine practitioners because you understand systems biology - how one intervention can affect multiple pathways. Our Vibrotactile Technology works through mechanoreceptor activation to modulate neural signaling. It's a non-pharmaceutical approach that doesn't compete with your root-cause work. Would you be interested in learning how other FM practitioners are integrating this?""",
        
        "key_hook": "symptomatic support while root-cause work takes effect - no metabolic load, no interactions",
        
        "patient_types": "complex chronic conditions (autoimmune, metabolic, hormonal), patients who have 'tried everything', GI dysfunction affecting absorption, chronic fatigue and mitochondrial issues, cognitive decline and brain fog, high-performing individuals optimizing health",
        
        "pain_points": """- Need symptomatic support while root-cause work takes effect
- Patients on multiple supplements with polypharmacy concerns
- Looking for non-oral options for sensitive patients
- Patients frustrated waiting for results from foundational work
- Balancing comprehensive protocols with patient compliance
""",
        
        "why_superpatch_fits": "SuperPatch bridges the gap while root-cause work progresses. No metabolic load - nothing to absorb, metabolize, or detoxify. No interactions with your other interventions. Provides symptomatic support without compromising your foundational protocols.",
        
        "top_products_context": {
            "Freedom": "Pain support while addressing root causes - doesn't interfere with protocols",
            "REM": "Sleep support while optimizing circadian biology - 80% stopped sleep meds",
            "Peace": "HPA axis support - calms nervous system without adding metabolic load"
        },
        
        "discovery_questions_context": """When discovering their practice, ask questions relevant to FM:
- "How do you typically structure your approach - what's your framework for root-cause investigation?"
- "What's the biggest challenge for patients during the foundational phase of treatment?"
- "How do you currently provide symptomatic support while root-cause work is underway?"
- "How many supplements or interventions are your patients typically on?"
- "Do you have patients who are sensitive to oral supplements or have absorption issues?"
""",
        
        "objection_responses": {
            "focus_on_root_causes": """I completely respect that - it's the foundation of FM. But symptomatic support doesn't have to mean suppression. VTT works WITH neural pathways, not against them. Unlike drugs, when the root cause is resolved, you can discontinue without rebound or dependency.""",
            "patients_on_too_many_things": """That's exactly why this might help. Unlike another supplement to take, process, and interact with everything else, this is a simple patch working through skin receptors. No pills to time, no absorption to optimize, no interactions. For patients with protocol fatigue, this doesn't add complexity.""",
            "seems_like_band_aiding": """I understand that concern. Think of it this way: when someone breaks their leg, you set the bone AND manage pain. The pain management doesn't prevent healing - it supports it. Similarly, VTT provides symptomatic support while your root-cause work addresses dysfunction."""
        },
        
        "closing_context": "This provides symptomatic support while your root-cause work takes effect - no metabolic load, no interactions, just neural pathway support. Ready to try the Practitioner Kit?"
    },
    
    "Integrative_Medicine": {
        "type_abbrev": "integrative physician",
        "type_full": "integrative medicine physician",
        "type_plural": "integrative medicine physicians",
        "practice_type": "integrative medicine practice",
        
        "philosophy": "You understand integrative medicine combines conventional Western medicine with evidence-based complementary approaches, focusing on the whole person. They seek appropriate interventions from both paradigms, emphasizing patient-centered care.",
        
        "opening_script": """Hi, this is Jennifer with SuperPatch. I'm reaching out to integrative medicine physicians who are looking for evidence-based alternatives to pharmaceuticals. Our Vibrotactile Technology patches have completed peer-reviewed clinical trials - the Freedom patch has an RCT for pain, and the REM patch has a study showing 80% of participants stopped sleep medications. Would you be interested in adding an evidence-based non-pharmaceutical option to your toolkit?""",
        
        "key_hook": "clinical-grade evidence for a drug-free technology - the best of both worlds",
        
        "patient_types": "chronic pain patients seeking alternatives to opioids, cancer patients and survivors, autoimmune conditions, mental health alongside physical health, patients dissatisfied with conventional-only care, high-functioning professionals optimizing wellness",
        
        "pain_points": """- Balancing conventional expectations with integrative approaches
- Finding evidence-based alternatives to prescriptions
- Patients wanting "something different" but with credibility
- Managing pain without escalating to stronger medications
- Supporting patients through pharmaceutical reduction
""",
        
        "why_superpatch_fits": "SuperPatch gives you the best of both worlds: clinical-grade evidence (peer-reviewed RCTs) for a completely non-pharmaceutical technology. Your patients want alternatives with credibility - this delivers both.",
        
        "top_products_context": {
            "Freedom": "Peer-reviewed RCT, Pain Therapeutics journal, ClinicalTrials.gov registered (NCT06505005)",
            "REM": "HARMONI study - 80% stopped sleep medications. Great for patients wanting to reduce meds.",
            "Liberty": "31% improvement in balance, p<0.05 statistical significance"
        },
        
        "discovery_questions_context": """When discovering their practice, ask questions relevant to integrative medicine:
- "How do you typically balance conventional and complementary approaches?"
- "What percentage of patients are specifically seeking alternatives to medications?"
- "How do you currently manage chronic pain without escalating to stronger pharmaceuticals?"
- "What options do you offer patients who want to reduce their medication burden?"
- "How important is published clinical evidence for modalities you recommend?"
""",
        
        "objection_responses": {
            "never_heard_is_it_credible": """Fair question. The Freedom patch has a peer-reviewed RCT published in Pain Therapeutics. The technology is based on mechanoreceptor science - the same field that won the 2021 Nobel Prize in Medicine. I can send you the clinical study.""",
            "fits_alongside_conventional": """It fits as first-line or adjunct. Because it's non-pharmaceutical with no interactions, you can layer it with conventional treatments or try it first. For pain: "Let's try this before escalating to medications." For sleep: part of a reduction strategy.""",
            "patients_skeptical_of_patches": """Understandable if they've tried transdermal drug patches. This is fundamentally different - not delivering a substance. The mechanism is physical pattern stimulation, not chemical delivery. Framing it as "Nobel Prize-recognized technology" often helps."""
        },
        
        "closing_context": "This gives you evidence-based medicine in a drug-free format - the best of both worlds for integrative practice. Ready to try it with your patients?"
    },
    
    "Acupuncturists": {
        "type_abbrev": "LAc",
        "type_full": "acupuncturist",
        "type_plural": "acupuncturists",
        "practice_type": "acupuncture practice",
        
        "philosophy": "You understand acupuncturists work with Qi (vital energy) flow through meridians to restore balance and support self-healing. They understand that subtle interventions can produce significant physiological effects.",
        
        "opening_script": """Hi, this is Jennifer with SuperPatch. I'm reaching out to acupuncturists because you already understand something Western medicine is just discovering - that stimulating specific points on the skin can have profound effects throughout the body. Our Vibrotactile Technology works through mechanoreceptors to activate neural pathways. It's a different modality, but the principle of skin-to-system connection is similar. Would you be interested in learning more?""",
        
        "key_hook": "like acupuncture without needles - gives patients drug-free support between sessions",
        
        "patient_types": "chronic pain (back, neck, joint, headaches), stress, anxiety, emotional imbalance, sleep disorders, digestive issues, general wellness, athletes and performers",
        
        "pain_points": """- Patients lose treatment benefits between sessions
- Need take-home options that don't involve needles
- Limited options for patient self-care between visits
- Patients can't needle themselves at home
- Competition with other pain management approaches
""",
        
        "why_superpatch_fits": "SuperPatch works through a similar principle - skin stimulation affecting the whole body. It's not acupuncture, but it gives patients drug-free support for the time between sessions. Think of it as a take-home bridge.",
        
        "top_products_context": {
            "Freedom": "Supports Qi flow where there's stagnation - for pain patients",
            "REM": "Calms Shen, supports Heart-Kidney axis - for sleep issues",
            "Peace": "Soothes Liver Qi stagnation, calms the mind - for stress and anxiety"
        },
        
        "tcm_correlations": """TCM Language for Patients:
- Freedom: Supports Qi flow, reduces stagnation effects
- REM: Calms Shen, supports Heart-Kidney axis
- Peace: Soothes Liver Qi stagnation
- Boost: Supports Spleen Qi, tonifies energy
- Liberty: Stabilizes Kidney essence, grounds energy
- Focus: Clears mind, supports Kidney-Brain connection
- Defend: Strengthens Wei Qi
- Joy: Harmonizes Heart Qi, lifts spirit""",
        
        "discovery_questions_context": """When discovering their practice, ask questions relevant to LAcs:
- "Do your patients ever express frustration that they 'lose' the benefits before their next appointment?"
- "What do you currently recommend for patients to do at home to support their treatment?"
- "How do your pain patients manage discomfort between sessions?"
- "What's been your experience with take-home recommendations - auricular seeds, magnets, similar?"
- "How important is it that anything you recommend aligns with supporting the body's self-healing?"
""",
        
        "objection_responses": {
            "not_real_acupuncture": """You're absolutely right - it's not acupuncture, and we'd never claim that. It's a complementary technology working through a different mechanism - mechanoreceptor stimulation versus needle insertion. Many acupuncturists see it as a take-home bridge between sessions, not a replacement.""",
            "patients_want_natural": """This is about as natural as it gets. No chemicals, no drugs, nothing entering the body. It's purely a physical pattern stimulating nerve receptors. Think of it like continuous, gentle pressure rather than a substance.""",
            "how_does_it_work_in_tcm": """While VTT is Western technology, practitioners frame it in TCM language. Freedom supports Qi flow for pain; REM calms the Shen for sleep; Peace soothes Liver Qi for stress. The mechanism is neural pathway activation, but effects map well to TCM patterns."""
        },
        
        "closing_context": "This gives your patients drug-free support between sessions - like homework that maintains treatment progress. Ready to try the Practitioner Kit?"
    }
}


def inject_context_into_prompt(prompt: str, context: dict) -> str:
    """Inject practitioner-specific context into a prompt."""
    
    # Build the practitioner context block
    practitioner_block = f"""
## PRACTITIONER CONTEXT: {context['type_plural'].upper()}
{context['philosophy']}

## Key Hook for {context['type_plural'].title()}
{context['key_hook']}

## Patient Types They See
{context['patient_types']}

## Their Pain Points (what frustrates them)
{context['pain_points']}

## Why SuperPatch Fits Their Practice
{context['why_superpatch_fits']}

## Top Products to Recommend
""" + "\n".join(f"- {k}: {v}" for k, v in context['top_products_context'].items())
    
    # Insert after the base personality section (after "Made in USA")
    if "Made in USA" in prompt:
        parts = prompt.split("Made in USA", 1)
        return parts[0] + "Made in USA\n" + practitioner_block + "\n" + parts[1]
    else:
        # If pattern not found, prepend context
        return practitioner_block + "\n\n" + prompt


def update_introduction_node(prompt: str, context: dict) -> str:
    """Update the Introduction node with practitioner-specific opening."""
    
    # Replace generic opening with practitioner-specific one
    new_opening_section = f"""## Your Opening for {context['type_plural'].title()}
Start with: "{context['opening_script']}"

Adapt for time of day:
- Morning: "Good morning! Hope I'm not catching you before your first patient..."
- Afternoon: "Hi there, hope your day's going well..."

"""
    
    # Replace the existing opening section
    prompt = re.sub(
        r'## Your Opening.*?(?=## Listen For)',
        new_opening_section,
        prompt,
        flags=re.DOTALL
    )
    
    # Also update references to generic practitioner
    prompt = prompt.replace("chiropractors practice", f"{context['practice_type']}")
    prompt = prompt.replace("DCs", context['type_plural'])
    
    return inject_context_into_prompt(prompt, context)


def update_discovery_nodes(prompt: str, context: dict) -> str:
    """Update discovery nodes with practitioner-specific questions."""
    
    discovery_section = f"""
## Discovery Questions for {context['type_plural'].title()}
{context['discovery_questions_context']}
"""
    
    # Add discovery context before the active listening section
    if "## Active Listening" in prompt:
        prompt = prompt.replace("## Active Listening", discovery_section + "\n## Active Listening")
    
    return inject_context_into_prompt(prompt, context)


def update_objection_nodes(prompt: str, context: dict) -> str:
    """Update objection nodes with practitioner-specific responses."""
    
    # Check if any objection keys match this node
    for objection_key, response in context['objection_responses'].items():
        # Add the specific response as additional context
        if objection_key.lower() in prompt.lower() or any(keyword in prompt.lower() for keyword in objection_key.split('_')):
            objection_section = f"""
## {context['type_plural'].title()}-Specific Response
{response}
"""
            # Add before "## After Addressing" if it exists
            if "## After Addressing" in prompt:
                prompt = prompt.replace("## After Addressing", objection_section + "\n## After Addressing")
    
    return inject_context_into_prompt(prompt, context)


def update_closing_nodes(prompt: str, context: dict) -> str:
    """Update closing/business model nodes with practitioner-specific language."""
    
    closing_section = f"""
## Closing for {context['type_plural'].title()}
{context['closing_context']}
"""
    
    return inject_context_into_prompt(prompt, context) + closing_section


def update_pathway(practitioner_key: str, pathway_id: str):
    """Load, update, and deploy a pathway."""
    
    # Load the expanded pathway
    filename = f"{practitioner_key}_expanded.json"
    try:
        with open(filename) as f:
            pathway = json.load(f)
    except FileNotFoundError:
        print(f"  ✗ File not found: {filename}")
        return False
    
    context = PRACTITIONER_CONTEXTS[practitioner_key]
    
    # Update each node's prompt based on node type
    for node in pathway['nodes']:
        node_name = node['data'].get('name', '')
        prompt = node['data'].get('prompt', '')
        
        if not prompt:
            continue
            
        # Introduction node
        if 'Introduction' in node_name and node['data'].get('isStart'):
            node['data']['prompt'] = update_introduction_node(prompt, context)
        
        # Discovery nodes
        elif 'Discovery' in node_name:
            node['data']['prompt'] = update_discovery_nodes(prompt, context)
        
        # Product presentation nodes
        elif 'Present:' in node_name:
            node['data']['prompt'] = inject_context_into_prompt(prompt, context)
        
        # Objection nodes
        elif 'Objection:' in node_name:
            node['data']['prompt'] = update_objection_nodes(prompt, context)
        
        # Business model and closing nodes
        elif 'Business Model' in node_name or 'Close:' in node_name:
            node['data']['prompt'] = update_closing_nodes(prompt, context)
        
        # All other nodes - add basic context
        else:
            node['data']['prompt'] = inject_context_into_prompt(prompt, context)
    
    # Update pathway name/description
    pathway['name'] = f"SuperPatch - {practitioner_key.replace('_', ' ')} Sales"
    pathway['description'] = f"Practitioner-specific pathway for {context['type_plural']} with unique scripts, questions, objections from word tracks."
    
    # Save updated pathway
    output_file = f"{practitioner_key}_contextual.json"
    with open(output_file, 'w') as f:
        json.dump(pathway, f, indent=2)
    
    # Deploy to Bland.ai
    cmd1 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{output_file}'
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    cmd2 = f'curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" -H "Content-Type: application/json" -H "authorization: {API_KEY}" -d @{output_file}'
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    try:
        s1 = json.loads(r1.stdout).get('status', 'error')
        s2 = json.loads(r2.stdout).get('status', 'error')
        return s1 == 'success' or s2 == 'success'
    except:
        return False


if __name__ == "__main__":
    print("="*70)
    print("UPDATING EXPANDED PATHWAYS WITH PRACTITIONER-SPECIFIC CONTEXT")
    print("="*70)
    print("\nThis preserves the full 34-node structure while injecting:")
    print("  - Practitioner-specific opening scripts")
    print("  - Unique discovery questions")
    print("  - Custom objection responses")
    print("  - Tailored closing scripts")
    print("  - Practice philosophy context")
    
    for practitioner, pathway_id in PATHWAYS.items():
        context = PRACTITIONER_CONTEXTS[practitioner]
        print(f"\n{'='*60}")
        print(f"Updating: {practitioner}")
        print(f"  Type: {context['type_full']}")
        print(f"  Hook: {context['key_hook'][:50]}...")
        
        success = update_pathway(practitioner, pathway_id)
        if success:
            print(f"  ✓ Deployed successfully")
        else:
            print(f"  ✗ Deployment issue - check manually")
    
    print("\n" + "="*70)
    print("UPDATE COMPLETE")
    print("="*70)
    print("\nEach pathway now has unique context while keeping full 34-node flow:")
    for p, ctx in PRACTITIONER_CONTEXTS.items():
        print(f"  - {p}: {ctx['key_hook'][:45]}...")
