#!/usr/bin/env python3
"""
Add Qualification Variables to Bland.ai Pathways

This script safely adds new extractVars to existing pathways WITHOUT modifying
any other node or edge configurations.

Safety Features:
- Fetches current pathway first (preserves everything)
- Backs up to JSON before any changes
- Dry-run mode to preview changes
- Only ADDS extractVars, never removes or modifies other fields

Usage:
    # Preview changes (dry run)
    python add_qualification_vars.py --dry-run
    
    # Apply changes to all pathways
    python add_qualification_vars.py
    
    # Apply to specific pathway
    python add_qualification_vars.py --pathway Chiropractors
"""

import json
import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Configuration
API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
BASE_URL = "https://api.bland.ai/v1"

# Pathway IDs (from deployed_pathway_ids.json)
PATHWAYS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage_Therapists": "d202aad7-bcb6-478c-a211-b00877545e05",
    "Naturopaths": "1d07d635-147e-4f69-a4cd-c124b33b073d",
    "Integrative_Medicine": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
    "Functional_Medicine": "236dbd85-c74d-4774-a7af-4b5812015c68",
    "Acupuncturists": "154f93f4-54a5-4900-92e8-0fa217508127",
}

# NEW qualification variables to add to specific nodes
# Format: { "node_name_pattern": [list of extractVars to add] }
QUALIFICATION_VARS_BY_NODE = {
    # Introduction / Start node - capture who we're speaking with
    "Introduction": [
        {"name": "contact_name", "description": "Name of the person we're speaking with"},
        {"name": "contact_role", "description": "Their role: owner, office_manager, receptionist, practitioner, other"},
    ],
    
    # Discovery node - capture qualification info
    "Discovery": [
        {"name": "decision_maker", "description": "Boolean - whether they make purchasing decisions"},
        {"name": "practice_size", "description": "Number of practitioners in the practice"},
        {"name": "patient_volume", "description": "Approximate patient volume (e.g., 'high', 'medium', 'low' or specific number)"},
        {"name": "pain_points", "description": "Main challenges or pain points they mentioned"},
        {"name": "current_solutions", "description": "What products/solutions they currently use"},
    ],
    
    # Objection handling - capture what concerns they raised
    "Objection": [
        {"name": "objections", "description": "Main objections or concerns they raised"},
    ],
    "Handle Objections": [
        {"name": "objections", "description": "Main objections or concerns they raised"},
    ],
    
    # Interest/Presentation nodes - capture interest level
    "Product Presentation": [
        {"name": "interest_level", "description": "Interest level: high, medium, low, or not_interested"},
        {"name": "products_interested", "description": "Which specific products they showed interest in"},
    ],
    "Presentation": [
        {"name": "interest_level", "description": "Interest level: high, medium, low, or not_interested"},
        {"name": "products_interested", "description": "Which specific products they showed interest in"},
    ],
    
    # Close/Follow-up nodes - capture next steps
    "Close": [
        {"name": "follow_up_action", "description": "Next action: send_info, callback, sample, demo, or none"},
        {"name": "decision_timeline", "description": "When they plan to make a decision"},
    ],
    "Close or Schedule": [
        {"name": "follow_up_action", "description": "Next action: send_info, callback, sample, demo, or none"},
        {"name": "decision_timeline", "description": "When they plan to make a decision"},
    ],
    
    # Follow-up nodes - capture scheduling info
    "Follow Up": [
        {"name": "follow_up_date", "description": "Date/time for follow-up"},
        {"name": "best_callback_time", "description": "Best time to call them back"},
        {"name": "contact_email", "description": "Email address for sending information"},
    ],
    "Follow Up Setup": [
        {"name": "follow_up_date", "description": "Date/time for follow-up"},
        {"name": "best_callback_time", "description": "Best time to call them back"},
        {"name": "contact_email", "description": "Email address for sending information"},
    ],
    "Schedule Callback": [
        {"name": "best_callback_time", "description": "Best time to call them back"},
    ],
    
    # Capture email node
    "Capture Email": [
        {"name": "contact_email", "description": "Email address"},
    ],
}


def api_request(method: str, endpoint: str, data: dict = None) -> dict:
    """Make an API request using curl."""
    url = f"{BASE_URL}/{endpoint}"
    
    cmd = ['curl', '-s', '-X', method, url,
           '-H', f'authorization: {API_KEY}',
           '-H', 'Content-Type: application/json']
    
    if data:
        cmd.extend(['-d', json.dumps(data)])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    try:
        return json.loads(result.stdout)
    except:
        return {"status": "error", "message": result.stdout or result.stderr}


def fetch_pathway(pathway_id: str) -> Optional[Dict]:
    """Fetch the current pathway configuration from Bland.ai."""
    print(f"  Fetching pathway {pathway_id}...")
    result = api_request("GET", f"pathway/{pathway_id}")
    
    if "error" in result or result.get("status") == "error":
        print(f"  ❌ Error fetching pathway: {result}")
        return None
    
    return result


def backup_pathway(pathway_name: str, pathway_data: Dict, backup_dir: Path) -> str:
    """Save pathway to backup file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backup_dir / f"{pathway_name}_backup_{timestamp}.json"
    
    with open(backup_file, 'w') as f:
        json.dump(pathway_data, f, indent=2)
    
    return str(backup_file)


def find_matching_nodes(nodes: List[Dict], pattern: str) -> List[Dict]:
    """Find nodes whose name contains the pattern."""
    matching = []
    for node in nodes:
        node_name = node.get("data", {}).get("name", "")
        if pattern.lower() in node_name.lower():
            matching.append(node)
    return matching


def add_extract_vars_to_node(node: Dict, new_vars: List[Dict]) -> tuple[Dict, List[str]]:
    """
    Add new extractVars to a node, preserving existing ones.
    Returns the modified node and list of vars that were added.
    """
    data = node.get("data", {})
    existing_vars = data.get("extractVars", [])
    
    # Get existing var names to avoid duplicates
    existing_names = set()
    for var in existing_vars:
        if isinstance(var, dict):
            existing_names.add(var.get("name", ""))
        elif isinstance(var, list) and len(var) > 0:
            existing_names.add(var[0])
    
    # Add new vars that don't already exist
    added = []
    for new_var in new_vars:
        var_name = new_var.get("name", "")
        if var_name and var_name not in existing_names:
            existing_vars.append(new_var)
            added.append(var_name)
            existing_names.add(var_name)
    
    # Update the node
    if added:
        data["extractVars"] = existing_vars
        node["data"] = data
    
    return node, added


def update_pathway_vars(pathway_name: str, pathway_id: str, dry_run: bool = True, backup_dir: Path = None) -> Dict:
    """
    Add qualification variables to a pathway.
    
    Returns a summary of changes made.
    """
    print(f"\n{'='*60}")
    print(f"Processing: {pathway_name}")
    print(f"Pathway ID: {pathway_id}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
    print(f"{'='*60}")
    
    # Fetch current pathway
    pathway_data = fetch_pathway(pathway_id)
    if not pathway_data:
        return {"status": "error", "message": "Failed to fetch pathway"}
    
    # Extract nodes and edges
    nodes = pathway_data.get("nodes", [])
    edges = pathway_data.get("edges", [])
    
    print(f"  Current pathway has {len(nodes)} nodes and {len(edges)} edges")
    
    # Backup before making changes
    if backup_dir and not dry_run:
        backup_file = backup_pathway(pathway_name, pathway_data, backup_dir)
        print(f"  📁 Backed up to: {backup_file}")
    
    # Track changes
    changes = []
    modified_nodes = []
    
    # Process each node pattern
    for pattern, vars_to_add in QUALIFICATION_VARS_BY_NODE.items():
        matching_nodes = find_matching_nodes(nodes, pattern)
        
        for node in matching_nodes:
            node_name = node.get("data", {}).get("name", "Unknown")
            node_id = node.get("id", "Unknown")
            
            # Add vars to this node
            modified_node, added_vars = add_extract_vars_to_node(node, vars_to_add)
            
            if added_vars:
                changes.append({
                    "node_id": node_id,
                    "node_name": node_name,
                    "vars_added": added_vars
                })
                modified_nodes.append(modified_node)
                print(f"  ✅ Node '{node_name}': Adding {added_vars}")
    
    # Summary
    print(f"\n  📊 Summary: {len(changes)} nodes will be modified")
    
    if not changes:
        print("  ℹ️  No changes needed - all vars already exist")
        return {"status": "no_changes", "pathway": pathway_name}
    
    # Apply changes (if not dry run)
    if not dry_run:
        print(f"\n  🚀 Applying changes...")
        
        # Build update payload - only send nodes and edges
        update_payload = {
            "name": pathway_data.get("name", f"SuperPatch - {pathway_name} Sales"),
            "description": pathway_data.get("description", ""),
            "nodes": nodes,
            "edges": edges,
        }
        
        # Update main pathway (draft)
        result = api_request("POST", f"pathway/{pathway_id}", update_payload)
        
        if result.get("status") == "success":
            print(f"  ✅ Pathway draft updated!")
        else:
            print(f"  ⚠️  Draft update response: {result}")
        
        # Create a NEW version (per Bland.ai API docs)
        print(f"  Creating new version...")
        version_result = api_request("POST", f"pathway/{pathway_id}/version", update_payload)
        
        version_number = None
        if version_result.get("status") == "success":
            data = version_result.get("data", {})
            version_number = data.get("version_number")
            print(f"  ✅ Created version {version_number}")
        else:
            print(f"  ⚠️  Version create response: {version_result}")
            # Try to extract version number anyway
            if isinstance(version_result.get("data"), dict):
                version_number = version_result["data"].get("version_number")
        
        if version_number:
            # Promote to production
            print(f"  Promoting version {version_number} to production...")
            publish_payload = {
                "version_id": version_number,
                "environment": "production"
            }
            publish_result = api_request("POST", f"pathway/{pathway_id}/publish", publish_payload)
            
            if "published successfully" in str(publish_result).lower():
                print(f"  ✅ Version {version_number} published to PRODUCTION!")
            else:
                print(f"  ⚠️  Publish response: {publish_result}")
        else:
            print(f"  ❌ Could not determine version number to publish")
            return {"status": "error", "message": "Version creation failed", "pathway": pathway_name}
    
    return {
        "status": "success" if not dry_run else "dry_run",
        "pathway": pathway_name,
        "changes": changes,
        "nodes_modified": len(changes)
    }


def main():
    """Main execution."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Add qualification variables to Bland.ai pathways")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--pathway", type=str, help="Update specific pathway (e.g., 'Chiropractors')")
    args = parser.parse_args()
    
    # Setup
    script_dir = Path(__file__).parent
    backup_dir = script_dir / "backups"
    backup_dir.mkdir(exist_ok=True)
    
    print("="*70)
    print("BLAND.AI PATHWAY VARIABLE UPDATER")
    print("="*70)
    print(f"Mode: {'DRY RUN (preview only)' if args.dry_run else 'LIVE UPDATE'}")
    print(f"Backup directory: {backup_dir}")
    print()
    
    if not args.dry_run:
        print("⚠️  WARNING: This will modify your Bland.ai pathways!")
        print("    Run with --dry-run first to preview changes.")
        response = input("    Continue? (yes/no): ")
        if response.lower() != "yes":
            print("Aborted.")
            sys.exit(0)
    
    # Select pathways to update
    if args.pathway:
        if args.pathway not in PATHWAYS:
            print(f"❌ Unknown pathway: {args.pathway}")
            print(f"   Available: {', '.join(PATHWAYS.keys())}")
            sys.exit(1)
        pathways_to_update = {args.pathway: PATHWAYS[args.pathway]}
    else:
        pathways_to_update = PATHWAYS
    
    # Process each pathway
    results = []
    for name, pathway_id in pathways_to_update.items():
        result = update_pathway_vars(
            pathway_name=name,
            pathway_id=pathway_id,
            dry_run=args.dry_run,
            backup_dir=backup_dir
        )
        results.append(result)
    
    # Final summary
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)
    
    for result in results:
        status_icon = "✅" if result.get("status") == "success" else "📋" if result.get("status") == "dry_run" else "❌"
        pathway = result.get("pathway", "Unknown")
        nodes_modified = result.get("nodes_modified", 0)
        print(f"  {status_icon} {pathway}: {nodes_modified} nodes {'would be ' if args.dry_run else ''}modified")
    
    if args.dry_run:
        print("\n💡 To apply these changes, run without --dry-run flag")
    else:
        print("\n✅ All pathways updated!")
        
        # Save update log
        log_file = backup_dir / f"update_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(log_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"📝 Update log saved to: {log_file}")


if __name__ == "__main__":
    main()
