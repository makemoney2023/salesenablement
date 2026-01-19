#!/usr/bin/env python3
"""
SuperPatch Bland.ai CLI Tool

A comprehensive command-line interface for managing Bland.ai calls.

Usage:
    python3 bland_cli.py call --phone "+15551234567" --pathway chiropractors
    python3 bland_cli.py status --call-id "abc123"
    python3 bland_cli.py recording --call-id "abc123" --output recording.mp3
    python3 bland_cli.py analyze --call-id "abc123"
    python3 bland_cli.py list --limit 10
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime

# Configuration
API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
BASE_URL = "https://api.bland.ai/v1"
KB_ID = "b671527d-0c2d-4a21-9586-033dad3b0255"

# Cal.com Integration Tools
CHECK_AVAILABILITY_TOOL = "TL-79a3c232-ca51-4244-b5d2-21f4e70fd872"
BOOK_APPOINTMENT_TOOL = "TL-bbaa7f38-1b6a-4f27-ad27-18fb7c6e1526"

# Voice ID for Jennifer
VOICE_ID = "78c8543e-e5fe-448e-8292-20a7b8c45247"

# Pathway IDs
PATHWAYS = {
    "chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "massage": "d202aad7-bcb6-478c-a211-b00877545e05",
    "naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "integrative": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "functional": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

def api_request(method: str, endpoint: str, data: dict = None) -> dict:
    """Make an API request using curl."""
    url = f"{BASE_URL}/{endpoint}"
    
    cmd = [
        'curl', '-s', '-X', method, url,
        '-H', f'authorization: {API_KEY}',
        '-H', 'Content-Type: application/json'
    ]
    
    if data:
        cmd.extend(['-d', json.dumps(data)])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    try:
        return json.loads(result.stdout)
    except:
        return {"status": "error", "message": result.stdout or result.stderr}


def make_call(phone_number: str, pathway: str, **kwargs) -> dict:
    """
    Send a call using POST /v1/calls
    https://docs.bland.ai/api-v1/post/calls
    """
    if pathway not in PATHWAYS:
        print(f"Error: Unknown pathway '{pathway}'")
        print(f"Available: {', '.join(PATHWAYS.keys())}")
        sys.exit(1)
    
    payload = {
        "phone_number": phone_number,
        "pathway_id": PATHWAYS[pathway],
        "voice": kwargs.get("voice", VOICE_ID),
        "first_sentence": kwargs.get("first_sentence", "Hi, this is Jennifer with SuperPatch."),
        "wait_for_greeting": kwargs.get("wait_for_greeting", True),
        "record": kwargs.get("record", True),
        "max_duration": kwargs.get("max_duration", 15),  # 15 minutes
        # Note: tools cannot be passed with pathway_id - configure tools in the pathway itself
        # knowledge_base is also configured at pathway level
    }
    
    # Optional parameters
    if kwargs.get("from_number"):
        payload["from"] = kwargs["from_number"]
    if kwargs.get("webhook"):
        payload["webhook"] = kwargs["webhook"]
    if kwargs.get("metadata"):
        payload["metadata"] = kwargs["metadata"]
    
    return api_request("POST", "calls", payload)


def get_call_details(call_id: str) -> dict:
    """
    Get call details using GET /v1/calls/{id}
    https://docs.bland.ai/api-v1/get/calls-id
    """
    return api_request("GET", f"calls/{call_id}")


def get_call_recording(call_id: str, output_file: str = None) -> dict:
    """
    Get call recording using GET /v1/calls/{id}/recording
    https://docs.bland.ai/api-v1/get/calls-id-recording
    """
    result = api_request("GET", f"calls/{call_id}/recording")
    
    if output_file and result.get("url"):
        # Download the actual recording
        cmd = ['curl', '-s', '-o', output_file, result["url"]]
        subprocess.run(cmd)
        return {"status": "success", "message": f"Recording saved to {output_file}", "url": result["url"]}
    
    return result


def analyze_call(call_id: str, goal: str = None, questions: list = None) -> dict:
    """
    Analyze a call using POST /v1/calls/{id}/analyze
    https://docs.bland.ai/api-v1/post/calls-id-analyze
    """
    payload = {}
    
    if goal:
        payload["goal"] = goal
    else:
        payload["goal"] = "Determine if the practitioner is interested in scheduling a demo visit"
    
    if questions:
        payload["questions"] = questions
    else:
        payload["questions"] = [
            ["Was the practitioner interested?", "boolean"],
            ["Did they agree to schedule a demo?", "boolean"],
            ["What products were they most interested in?", "string"],
            ["What objections did they raise?", "string"],
            ["What is their practice type?", "string"],
            ["Overall sentiment", "positive, neutral, negative"],
        ]
    
    return api_request("POST", f"calls/{call_id}/analyze", payload)


def list_calls(limit: int = 10) -> dict:
    """
    List recent calls using GET /v1/calls
    https://docs.bland.ai/api-v1/get/calls
    """
    return api_request("GET", f"calls?limit={limit}")


def stop_call(call_id: str) -> dict:
    """
    Stop an active call using POST /v1/calls/{id}/stop
    https://docs.bland.ai/api-v1/post/calls-id-stop
    """
    return api_request("POST", f"calls/{call_id}/stop")


def format_call_details(data: dict) -> str:
    """Format call details for display."""
    output = []
    
    if "call_id" in data:
        output.append(f"Call ID: {data['call_id']}")
    if "status" in data:
        output.append(f"Status: {data['status']}")
    if "created_at" in data:
        output.append(f"Created: {data['created_at']}")
    if "call_length" in data:
        mins = data['call_length'] // 60
        secs = data['call_length'] % 60
        output.append(f"Duration: {mins}m {secs}s")
    if "to" in data:
        output.append(f"To: {data['to']}")
    if "from" in data:
        output.append(f"From: {data['from']}")
    if "completed" in data:
        output.append(f"Completed: {data['completed']}")
    if "pathway_id" in data:
        # Find pathway name
        pathway_name = "Unknown"
        for name, pid in PATHWAYS.items():
            if pid == data['pathway_id']:
                pathway_name = name
                break
        output.append(f"Pathway: {pathway_name}")
    
    # Transcript summary
    if "concatenated_transcript" in data:
        transcript = data['concatenated_transcript']
        if len(transcript) > 500:
            output.append(f"\nTranscript (first 500 chars):\n{transcript[:500]}...")
        else:
            output.append(f"\nTranscript:\n{transcript}")
    
    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description="SuperPatch Bland.ai CLI Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Make a call to a chiropractor
  python3 bland_cli.py call --phone "+15551234567" --pathway chiropractors
  
  # Get call status and details
  python3 bland_cli.py status --call-id "abc123-def456"
  
  # Download call recording
  python3 bland_cli.py recording --call-id "abc123" --output call.mp3
  
  # Analyze a completed call
  python3 bland_cli.py analyze --call-id "abc123"
  
  # List recent calls
  python3 bland_cli.py list --limit 5
  
  # Stop an active call
  python3 bland_cli.py stop --call-id "abc123"

Available Pathways:
  chiropractors, massage, naturopaths, integrative, functional, acupuncturists
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Call command
    call_parser = subparsers.add_parser("call", help="Make a new call")
    call_parser.add_argument("--phone", "-p", required=True, help="Phone number (E.164 format: +15551234567)")
    call_parser.add_argument("--pathway", "-w", required=True, choices=PATHWAYS.keys(), help="Pathway to use")
    call_parser.add_argument("--from-number", "-f", help="Caller ID number (optional)")
    call_parser.add_argument("--no-record", action="store_true", help="Don't record the call")
    call_parser.add_argument("--max-duration", type=int, default=15, help="Max duration in minutes (default: 15)")
    call_parser.add_argument("--webhook", help="Webhook URL for call events")
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Get call status and details")
    status_parser.add_argument("--call-id", "-c", required=True, help="Call ID")
    status_parser.add_argument("--json", action="store_true", help="Output raw JSON")
    
    # Recording command
    recording_parser = subparsers.add_parser("recording", help="Download call recording")
    recording_parser.add_argument("--call-id", "-c", required=True, help="Call ID")
    recording_parser.add_argument("--output", "-o", help="Output file path (e.g., recording.mp3)")
    
    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze a call with AI")
    analyze_parser.add_argument("--call-id", "-c", required=True, help="Call ID")
    analyze_parser.add_argument("--goal", "-g", help="Custom analysis goal")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List recent calls")
    list_parser.add_argument("--limit", "-l", type=int, default=10, help="Number of calls to show")
    
    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop an active call")
    stop_parser.add_argument("--call-id", "-c", required=True, help="Call ID")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    if args.command == "call":
        print(f"📞 Making call to {args.phone} using {args.pathway} pathway...")
        print(f"   Cal.com tools: ✓ Enabled")
        print(f"   Knowledge base: ✓ Enabled")
        print()
        
        result = make_call(
            args.phone,
            args.pathway,
            record=not args.no_record,
            max_duration=args.max_duration,
            from_number=args.from_number,
            webhook=args.webhook
        )
        
        if result.get("status") == "success":
            print(f"✅ Call queued successfully!")
            print(f"   Call ID: {result.get('call_id')}")
            print()
            print(f"Track this call:")
            print(f"   python3 bland_cli.py status --call-id {result.get('call_id')}")
        else:
            print(f"❌ Error: {result.get('message', result)}")
    
    elif args.command == "status":
        result = get_call_details(args.call_id)
        
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print("📊 Call Details")
            print("=" * 50)
            print(format_call_details(result))
    
    elif args.command == "recording":
        output = args.output or f"recording_{args.call_id}.mp3"
        print(f"🎙️ Downloading recording for call {args.call_id}...")
        
        result = get_call_recording(args.call_id, output)
        
        if result.get("status") == "success":
            print(f"✅ {result.get('message')}")
        else:
            print(json.dumps(result, indent=2))
    
    elif args.command == "analyze":
        print(f"🔍 Analyzing call {args.call_id}...")
        
        result = analyze_call(args.call_id, goal=args.goal)
        
        print()
        print("📊 Analysis Results")
        print("=" * 50)
        
        if "answers" in result:
            for answer in result["answers"]:
                print(f"• {answer}")
        else:
            print(json.dumps(result, indent=2))
    
    elif args.command == "list":
        result = list_calls(args.limit)
        
        print(f"📋 Recent Calls (showing {args.limit})")
        print("=" * 50)
        
        calls = result.get("calls", [])
        if not calls:
            print("No calls found.")
        else:
            for call in calls:
                call_id = (call.get("call_id") or "N/A")[:12]
                status = call.get("status") or "N/A"
                to_num = call.get("to") or "N/A"
                created = call.get("created_at") or "N/A"
                print(f"• {call_id}... | {status:10} | {to_num} | {created}")
    
    elif args.command == "stop":
        print(f"⏹️ Stopping call {args.call_id}...")
        
        result = stop_call(args.call_id)
        
        if result.get("status") == "success":
            print("✅ Call stopped successfully!")
        else:
            print(f"❌ Error: {result.get('message', result)}")


if __name__ == "__main__":
    main()
