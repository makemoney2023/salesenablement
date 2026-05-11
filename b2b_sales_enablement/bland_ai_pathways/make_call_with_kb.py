#!/usr/bin/env python3
"""
SuperPatch Sales Call with Knowledge Base Reference

Usage:
    # Basic call (without personalization)
    python3 make_call_with_kb.py --phone "+15551234567" --pathway chiropractors
    
    # Personalized call with practice context
    python3 make_call_with_kb.py --phone "+15551234567" --pathway chiropractors \
        --practice-name "Toronto Wellness" --address "123 Main St, Toronto"
    
    # Call with enrichment data (email, languages, team info)
    python3 make_call_with_kb.py --phone "+15551234567" --pathway chiropractors \
        --practice-name "Toronto Wellness" --province "Quebec" \
        --clinic-email "info@clinic.com" --languages "French,English" --team-count 3
    
Or import and use:
    from make_call_with_kb import make_superpatch_call
    make_superpatch_call("+15551234567", "chiropractors", practice_name="Toronto Wellness")
"""

import argparse
import json
import subprocess

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255"

# Cal.com Integration Tools
CHECK_AVAILABILITY_TOOL = "TL-79a3c232-ca51-4244-b5d2-21f4e70fd872"
BOOK_APPOINTMENT_TOOL = "TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526"

PATHWAYS = {
    "chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "massage": "d202aad7-bcb6-478c-a211-b00877545e05",
    "naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "integrative": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "functional": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

# Language mapping from enrichment data to Bland.ai language codes
LANGUAGE_MAP = {
    'French': 'fr-CA',
    'Spanish': 'es',
    'Mandarin': 'zh',
    'Cantonese': 'zh',
    'Korean': 'ko',
    'Japanese': 'ja',
    'Portuguese': 'pt',
    'Italian': 'it',
    'German': 'de',
    'Hindi': 'hi',
    'Punjabi': 'pa',
    'Vietnamese': 'vi',
    'Tagalog': 'tl',
    'Arabic': 'ar',
}

def get_call_language(enrichment_languages: list, province: str) -> str:
    """Determine the best language for the call based on enrichment data and location."""
    # Quebec defaults to French
    if province and 'Quebec' in province:
        return 'fr-CA'
    # Check enrichment for primary non-English language
    for lang in enrichment_languages:
        if lang and lang != 'English' and lang in LANGUAGE_MAP:
            return LANGUAGE_MAP[lang]
    return 'en'  # Default English

def get_first_sentence(practice_name: str, language: str) -> str:
    """Get the appropriate first sentence based on language."""
    if language == 'fr-CA':
        if practice_name:
            return f"Bonjour, c'est Jennifer de SuperPatch. Est-ce que je parle à quelqu'un de {practice_name}?"
        else:
            return "Bonjour, c'est Jennifer de SuperPatch."
    else:
        if practice_name:
            return f"Hi, this is Jennifer with SuperPatch. Am I speaking with someone from {practice_name}?"
        else:
            return "Hi, this is Jennifer with SuperPatch."

def make_superpatch_call(phone_number: str, pathway_type: str, **kwargs) -> dict:
    """
    Make a SuperPatch sales call with Knowledge Base reference.
    
    Args:
        phone_number: Phone number to call (E.164 format: +15551234567)
        pathway_type: One of: chiropractors, massage, naturopaths, integrative, functional, acupuncturists
        **kwargs: Additional call parameters including practice context:
            - practice_name: Name of the practice (for personalization)
            - practice_address: Address (for scheduling confirmation)
            - practice_city: City
            - practice_province: Province
            - google_rating: Google rating
            - review_count: Number of reviews
            - website: Practice website
            - clinic_email: Pre-filled email from enrichment data
            - clinic_languages: Languages spoken at clinic (comma-separated)
            - team_count: Number of practitioners at the clinic
            - enrichment: Full enrichment data dict (alternative to individual fields)
            - voice, record, max_duration, webhook, etc.
    
    Returns:
        API response as dict
    """
    if pathway_type not in PATHWAYS:
        raise ValueError(f"Unknown pathway: {pathway_type}. Available: {list(PATHWAYS.keys())}")
    
    # Build request_data with practice context for personalization
    request_data = {}
    practice_fields = [
        'practice_name', 'practice_address', 'practice_city', 'practice_province',
        'google_rating', 'review_count', 'website', 'practitioner_type'
    ]
    for field in practice_fields:
        if field in kwargs:
            request_data[field] = str(kwargs[field]) if kwargs[field] else ""
    
    # Flag if we have address (for scheduling confirmation flow)
    if kwargs.get('practice_address'):
        request_data['has_address'] = 'true'
    
    # ============================================
    # ENRICHMENT DATA (email, team_count, languages)
    # ============================================
    enrichment = kwargs.get('enrichment', {})
    enrichment_data = enrichment.get('data', {}) if enrichment else {}
    
    # Pre-filled email from enrichment
    clinic_email = kwargs.get('clinic_email')
    if not clinic_email and enrichment_data:
        emails = enrichment_data.get('emails', [])
        clinic_email = emails[0] if emails else None
    if clinic_email:
        request_data['clinic_email'] = clinic_email
    
    # Team count from enrichment
    team_count = kwargs.get('team_count')
    if team_count is None and enrichment_data:
        practitioners = enrichment_data.get('practitioners', [])
        team_count = len(practitioners) if practitioners else None
    if team_count:
        request_data['team_count'] = str(team_count)
    
    # Languages from enrichment
    clinic_languages = kwargs.get('clinic_languages')
    if not clinic_languages and enrichment_data:
        languages = enrichment_data.get('languages', [])
        clinic_languages = ','.join(languages) if languages else None
    if clinic_languages:
        request_data['clinic_languages'] = clinic_languages
    
    # ============================================
    # LANGUAGE DETECTION (for multilingual calls)
    # ============================================
    province = kwargs.get('practice_province', '')
    enrichment_languages = []
    if clinic_languages:
        enrichment_languages = [l.strip() for l in clinic_languages.split(',')]
    elif enrichment_data:
        enrichment_languages = enrichment_data.get('languages', [])
    
    call_language = get_call_language(enrichment_languages, province)
    
    # Build first sentence with personalization and language
    practice_name = kwargs.get('practice_name', '')
    first_sentence = get_first_sentence(practice_name, call_language)
    
    # ============================================
    # VOICEMAIL HANDLING
    # ============================================
    voicemail_message = f"""Hi, this is Jennifer from SuperPatch calling for {practice_name or 'your clinic'}. 

We work with wellness practitioners like yourself to provide drug-free solutions for pain, sleep, and stress.

I'd love to chat for just 5 minutes about how our products could help your patients. 

You can reach me at 1-800-SUPERPATCH, or I'll try you again soon. Have a great day!"""

    # French voicemail message for Quebec
    if call_language == 'fr-CA':
        voicemail_message = f"""Bonjour, c'est Jennifer de SuperPatch pour {practice_name or 'votre clinique'}. 

Nous travaillons avec des praticiens du bien-être comme vous pour offrir des solutions sans médicaments pour la douleur, le sommeil et le stress.

J'aimerais discuter quelques minutes de comment nos produits pourraient aider vos patients. 

Vous pouvez me joindre au 1-800-SUPERPATCH, ou je vous rappellerai bientôt. Bonne journée!"""

    # ============================================
    # BUILD PAYLOAD
    # ============================================
    payload = {
        "phone_number": phone_number,
        "pathway_id": PATHWAYS[pathway_type],
        "pathway_version": 1,  # Use version 1 (where we deploy updates)
        "knowledge_base": KB_ID,  # Connect KB for product/study information
        "voice": kwargs.get("voice", "78c8543e-e5fe-448e-8292-20a7b8c45247"),
        "first_sentence": first_sentence,
        "record": kwargs.get("record", True),
        "webhook": kwargs.get(
            "webhook",
            # Canonical webhook: Supabase Edge Function `webhook-processor`.
            # The legacy Next.js route /api/webhooks/bland was retired on 2026-05-12
            # and now returns HTTP 410. See canonical_ids.json -> webhooks.primary.
            "https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor",
        ),
        
        # ============================================
        # IVR NAVIGATION CONFIG
        # Must use "base" model - turbo doesn't support IVR
        # ============================================
        "model": "base",
        "wait_for_greeting": True,  # Wait for IVR/system to speak first
        "ignore_button_press": False,  # Allow DTMF interaction when needed
        "max_duration": kwargs.get("max_duration", 20),  # 20 min to allow for hold queues
        
        # Language for multilingual support
        "language": call_language,
        
        # Voicemail handling - use "ignore" to navigate through IVR
        # Falls back to leaving message on actual voicemail
        "voicemail": {
            "action": "ignore",  # Continue through IVR prompts
            "sensitive": True,   # AI-based voicemail detection
        },
    }
    
    # Add request_data if we have practice context
    if request_data:
        payload["request_data"] = request_data
    
    # Add metadata for tracking
    if practice_name or kwargs.get('metadata'):
        payload["metadata"] = kwargs.get('metadata', {})
        if practice_name:
            payload["metadata"]["practice_name"] = practice_name
            payload["metadata"]["source"] = "call_list"
        if clinic_email:
            payload["metadata"]["clinic_email"] = clinic_email
        if call_language != 'en':
            payload["metadata"]["call_language"] = call_language
    
    # ============================================
    # RETRY CONFIG (for voicemail/no-answer)
    # ============================================
    if kwargs.get('enable_retry', True):
        retry_voicemail_message = voicemail_message.replace(
            "I'd love to chat",
            "I wanted to make sure you got my earlier message. I'd still love to chat"
        )
        payload["retry"] = {
            "wait": 60,  # Wait 60 minutes before retry
            "voicemail_action": "leave_message",
            "voicemail_message": retry_voicemail_message,
        }
        # Override voicemail to leave message on retry
        payload["voicemail"]["action"] = "leave_message"
        payload["voicemail"]["message"] = voicemail_message
    
    # Add any extra parameters
    for key in ["from_number", "transfer_phone_number"]:
        if key in kwargs:
            payload[key] = kwargs[key]
    
    cmd = f'''curl -s -X POST "https://api.bland.ai/v1/calls" \
        -H "authorization: {API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{json.dumps(payload)}' '''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    try:
        return json.loads(result.stdout)
    except:
        return {"error": result.stdout, "stderr": result.stderr}


def make_batch_calls(phone_numbers: list, pathway_type: str, **kwargs) -> list:
    """Make multiple calls using the same pathway."""
    results = []
    for phone in phone_numbers:
        result = make_superpatch_call(phone, pathway_type, **kwargs)
        results.append({"phone": phone, "result": result})
        print(f"Called {phone}: {result.get('status', result.get('error', 'unknown'))}")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Make SuperPatch sales calls")
    parser.add_argument("--phone", required=True, help="Phone number (E.164 format)")
    parser.add_argument("--pathway", required=True, choices=PATHWAYS.keys(), help="Pathway type")
    parser.add_argument("--voice", default="78c8543e-e5fe-448e-8292-20a7b8c45247", help="Voice to use")
    parser.add_argument("--no-record", action="store_true", help="Don't record call")
    
    # Practice context for personalization
    parser.add_argument("--practice-name", help="Practice name (for personalized opening)")
    parser.add_argument("--address", help="Practice address (for scheduling confirmation)")
    parser.add_argument("--city", help="City")
    parser.add_argument("--province", help="Province")
    parser.add_argument("--rating", type=float, help="Google rating")
    parser.add_argument("--reviews", type=int, help="Review count")
    parser.add_argument("--website", help="Practice website")
    
    # Enrichment data for enhanced calls
    parser.add_argument("--clinic-email", help="Pre-filled clinic email from enrichment data")
    parser.add_argument("--languages", help="Languages spoken at clinic (comma-separated)")
    parser.add_argument("--team-count", type=int, help="Number of practitioners at the clinic")
    
    # Retry/voicemail options
    parser.add_argument("--no-retry", action="store_true", help="Disable automatic retry on voicemail")
    
    args = parser.parse_args()
    
    result = make_superpatch_call(
        args.phone, 
        args.pathway,
        voice=args.voice,
        record=not args.no_record,
        practice_name=args.practice_name,
        practice_address=args.address,
        practice_city=args.city,
        practice_province=args.province,
        google_rating=args.rating,
        review_count=args.reviews,
        website=args.website,
        clinic_email=args.clinic_email,
        clinic_languages=args.languages,
        team_count=args.team_count,
        enable_retry=not args.no_retry
    )
    
    print(json.dumps(result, indent=2))
