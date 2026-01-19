#!/usr/bin/env python3
"""
Update Existing Pathways on Bland.ai

Uses the CORRECT workflow to avoid "fetch version" errors:
1. Create a NEW VERSION with the updated content (POST to /pathway/{id}/version)
2. Publish that new version to production

This does NOT create new pathways - it updates existing ones by their ID.
"""

import json
import subprocess
from pathlib import Path

# API Configuration
API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")
BASE_URL = "https://api.bland.ai/v1"
SCRIPT_DIR = Path(__file__).parent

# Load existing pathway IDs
PATHWAY_IDS_FILE = SCRIPT_DIR / "deployed_pathway_ids.json"

# Mapping of pathway names to their JSON files
PATHWAY_FILES = {
    "Chiropractors": "Chiropractors_contextual.json",
    "Massage_Therapists": "Massage_Therapists_contextual.json",
    "Naturopaths": "Naturopaths_contextual.json",
    "Integrative_Medicine": "Integrative_Medicine_contextual.json",
    "Functional_Medicine": "Functional_Medicine_contextual.json",
    "Acupuncturists": "Acupuncturists_contextual.json",
}


def run_curl(method: str, endpoint: str, data_file: str = None, data_json: dict = None) -> dict:
    """Run curl command and return parsed JSON response."""
    url = f"{BASE_URL}/{endpoint}"
    
    cmd = ['curl', '-s', '-X', method, url,
           '-H', f'authorization: {API_KEY}',
           '-H', 'Content-Type: application/json']
    
    if data_file:
        cmd.extend(['-d', f'@{data_file}'])
    elif data_json:
        cmd.extend(['-d', json.dumps(data_json)])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    try:
        return json.loads(result.stdout)
    except:
        return {"status": "error", "raw": result.stdout or result.stderr}


def update_pathway(name: str, pathway_id: str, json_file: str) -> bool:
    """
    Update an existing pathway using the CORRECT workflow:
    1. Create a NEW VERSION with full content (not update existing version!)
    2. Publish that new version to production
    """
    print(f"\n{'='*60}")
    print(f"Updating: {name}")
    print(f"  Pathway ID: {pathway_id}")
    print(f"{'='*60}")
    
    file_path = SCRIPT_DIR / json_file
    
    if not file_path.exists():
        print(f"  ✗ File not found: {json_file}")
        return False
    
    # Load and verify the JSON file
    with open(file_path, 'r') as f:
        pathway_data = json.load(f)
    
    nodes = pathway_data.get("nodes", [])
    edges = pathway_data.get("edges", [])
    
    print(f"  Source: {json_file}")
    print(f"  Nodes: {len(nodes)}, Edges: {len(edges)}")
    
    # Count nodes with extractVars
    nodes_with_vars = sum(1 for n in nodes if 'extractVars' in n.get('data', {}))
    print(f"  Nodes with extractVars: {nodes_with_vars}")
    
    # Step 1: Create a NEW VERSION with full content
    # KEY: POST to /pathway/{id}/version CREATES a new version
    # This is what avoids the "fetch version" error
    print(f"\n  [1/2] Creating NEW version with updated content...")
    version_result = run_curl("POST", f"pathway/{pathway_id}/version", data_file=str(file_path))
    
    # Extract version number from response
    version_number = None
    if isinstance(version_result, dict):
        if "data" in version_result and isinstance(version_result["data"], dict):
            version_number = version_result["data"].get("version_number")
        elif "version_number" in version_result:
            version_number = version_result["version_number"]
    
    if not version_number:
        print(f"        WARNING: Could not get version number from: {version_result}")
        # Try to get current version and increment
        get_result = run_curl("GET", f"pathway/{pathway_id}")
        current_version = get_result.get("production_version_number", 2)
        version_number = current_version + 1
        print(f"        Using inferred version: {version_number}")
    else:
        print(f"        Created version: {version_number}")
    
    # Step 2: Publish to production
    print(f"  [2/2] Publishing version {version_number} to production...")
    prod_result = run_curl("POST", f"pathway/{pathway_id}/publish", data_json={
        "version_id": version_number,
        "environment": "production"
    })
    
    status = prod_result.get('message', prod_result.get('status', str(prod_result)))
    print(f"        Result: {status}")
    
    # Verify deployment
    verify_result = run_curl("GET", f"pathway/{pathway_id}")
    verified_nodes = len(verify_result.get("nodes", []))
    prod_version = verify_result.get("production_version_number", "unknown")
    
    if verified_nodes > 0:
        print(f"\n  ✅ Updated! Verified: {verified_nodes} nodes, production version: {prod_version}")
        return True
    else:
        print(f"\n  ⚠️ Could not verify update. Response: {verify_result}")
        return False


def main():
    print("=" * 70)
    print("UPDATE EXISTING PATHWAYS ON BLAND.AI")
    print("=" * 70)
    print("\nThis script uses the CORRECT workflow to avoid 'fetch version' errors:")
    print("  1. Create NEW VERSION with updated content (POST /pathway/{id}/version)")
    print("  2. Publish that new version to production")
    print("\nNOTE: This updates EXISTING pathways, does not create new ones.")
    
    # Load pathway IDs
    if not PATHWAY_IDS_FILE.exists():
        print(f"\n❌ Error: {PATHWAY_IDS_FILE} not found!")
        print("   Run deploy_fresh_complete.py first to create pathways.")
        return
    
    with open(PATHWAY_IDS_FILE, 'r') as f:
        pathway_ids = json.load(f)
    
    print(f"\nLoaded {len(pathway_ids)} pathway IDs from {PATHWAY_IDS_FILE.name}")
    
    # Update all pathways
    results = {}
    
    for name, json_file in PATHWAY_FILES.items():
        pathway_id = pathway_ids.get(name)
        
        if not pathway_id:
            print(f"\n⚠️ No ID found for {name}, skipping...")
            results[name] = False
            continue
        
        try:
            success = update_pathway(name, pathway_id, json_file)
            results[name] = success
        except Exception as e:
            print(f"  ❌ Error: {e}")
            results[name] = False
    
    # Summary
    print("\n" + "=" * 70)
    print("UPDATE SUMMARY")
    print("=" * 70)
    
    for name, success in results.items():
        status = "✓" if success else "✗"
        print(f"  {status} {name}")
    
    success_count = sum(1 for v in results.values() if v)
    print(f"\nTotal: {success_count}/{len(results)} pathways updated")
    
    if success_count == len(results):
        print("\n🚀 All pathways updated successfully!")
    else:
        print("\n⚠️ Some pathways failed to update. Check errors above.")


if __name__ == "__main__":
    main()
