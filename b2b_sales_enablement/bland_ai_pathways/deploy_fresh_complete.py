#!/usr/bin/env python3
"""
Fresh Complete Pathway Deployment

Deploys pathways using the CORRECT Bland.ai workflow:
1. Create pathway (gets empty pathway with auto-created versions 1 & 2)
2. Update pathway with full JSON content
3. CREATE A NEW VERSION with full JSON content (this gets version 3+)
4. Publish that NEW version to production

Key insight: You must CREATE a new version with the full content,
not just update an existing version. The version creation endpoint
is what properly stores the nodes/edges in a publishable version.
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

# Pathways to deploy (name, json_file)
PATHWAYS = [
    ("Chiropractors", "Chiropractors_contextual.json"),
    ("Massage_Therapists", "Massage_Therapists_contextual.json"),
    ("Naturopaths", "Naturopaths_contextual.json"),
    ("Integrative_Medicine", "Integrative_Medicine_contextual.json"),
    ("Functional_Medicine", "Functional_Medicine_contextual.json"),
    ("Acupuncturists", "Acupuncturists_contextual.json"),
]

# Current pathway IDs to delete (cleared - we delete manually before running)
OLD_IDS = []


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


def delete_pathway(pathway_id: str) -> bool:
    """Delete an existing pathway."""
    result = run_curl("DELETE", f"pathway/{pathway_id}")
    return "deleted" in str(result).lower() or "success" in str(result).lower()


def create_pathway(name: str, description: str) -> str:
    """Create a new empty pathway and return its ID."""
    result = run_curl("POST", "pathway/create", data_json={
        "name": name,
        "description": description
    })
    
    # Extract pathway_id from various response formats
    if isinstance(result, dict):
        if "pathway_id" in result:
            return result["pathway_id"]
        if "data" in result and isinstance(result["data"], dict):
            return result["data"].get("pathway_id") or result["data"].get("id")
    
    raise ValueError(f"Failed to create pathway: {result}")


def deploy_pathway(name: str, json_file: str) -> str:
    """
    Deploy a single pathway using the CORRECT Bland.ai workflow:
    1. Create pathway (gets empty pathway)
    2. Update pathway with full JSON file content
    3. CREATE A NEW VERSION with full content (returns version_number 3+)
    4. Publish that new version to production
    """
    print(f"\n{'='*60}")
    print(f"Deploying: {name}")
    print(f"{'='*60}")
    
    file_path = SCRIPT_DIR / json_file
    
    # Load and verify the JSON file
    with open(file_path, 'r') as f:
        pathway_data = json.load(f)
    
    nodes = pathway_data.get("nodes", [])
    edges = pathway_data.get("edges", [])
    pathway_name = pathway_data.get("name", f"SuperPatch - {name} Sales")
    description = pathway_data.get("description", "")
    
    print(f"  Source: {json_file}")
    print(f"  Nodes: {len(nodes)}, Edges: {len(edges)}")
    
    # Step 1: Create empty pathway
    print(f"\n  [1/4] Creating pathway...")
    pathway_id = create_pathway(pathway_name, description)
    print(f"        Pathway ID: {pathway_id}")
    
    # Step 2: Update pathway with FULL JSON file (using -d @file)
    print(f"  [2/4] Updating pathway with full content...")
    update_result = run_curl("POST", f"pathway/{pathway_id}", data_file=str(file_path))
    print(f"        Update result: {update_result.get('status', update_result.get('message', 'unknown'))}")
    
    # Step 3: CREATE A NEW VERSION with FULL content
    # This is the KEY - POST to /version (not /version/1) CREATES a new version
    # The version creation endpoint stores nodes/edges in the version properly
    print(f"  [3/4] Creating NEW version with full content...")
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
        version_number = 3  # Default to 3 (after auto-created 1 and 2)
    
    print(f"        Created version: {version_number}")
    
    # Step 4: Publish to production
    print(f"  [4/4] Publishing version {version_number} to production...")
    prod_result = run_curl("POST", f"pathway/{pathway_id}/publish", data_json={
        "version_id": version_number,
        "environment": "production"
    })
    print(f"        Production: {prod_result.get('message', prod_result)}")
    
    # Verify deployment
    verify_result = run_curl("GET", f"pathway/{pathway_id}")
    verified_nodes = len(verify_result.get("nodes", []))
    prod_version = verify_result.get("production_version_number", "unknown")
    print(f"\n  ✅ Deployed! Verified: {verified_nodes} nodes, production version: {prod_version}")
    
    return pathway_id


def main():
    print("=" * 70)
    print("FRESH COMPLETE PATHWAY DEPLOYMENT")
    print("=" * 70)
    print("\nThis script uses the CORRECT Bland.ai workflow:")
    print("  1. Create pathway")
    print("  2. Update with FULL JSON file (-d @file)")
    print("  3. CREATE NEW VERSION with FULL JSON file (key!)")
    print("  4. Publish that new version to production")
    
    # Step 0: Delete old pathways
    print("\n" + "-" * 70)
    print("Step 0: Deleting old pathways...")
    print("-" * 70)
    for old_id in OLD_IDS:
        if delete_pathway(old_id):
            print(f"  Deleted: {old_id}")
        else:
            print(f"  Already deleted or not found: {old_id}")
    
    # Deploy all pathways
    new_ids = {}
    
    for name, json_file in PATHWAYS:
        try:
            pathway_id = deploy_pathway(name, json_file)
            new_ids[name] = pathway_id
        except Exception as e:
            print(f"  ❌ Error: {e}")
            raise
    
    # Output summary
    print("\n" + "=" * 70)
    print("DEPLOYMENT COMPLETE")
    print("=" * 70)
    print("\nNew Pathway IDs:")
    print(json.dumps(new_ids, indent=2))
    
    # Save new IDs
    output_file = SCRIPT_DIR / "deployed_pathway_ids.json"
    with open(output_file, 'w') as f:
        json.dump(new_ids, f, indent=2)
    print(f"\nSaved to: {output_file}")
    
    return new_ids


if __name__ == "__main__":
    main()
