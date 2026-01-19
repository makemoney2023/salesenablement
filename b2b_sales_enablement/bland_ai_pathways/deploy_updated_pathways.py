#!/usr/bin/env python3
"""
Deploy updated pathways to Bland.ai

Updates existing pathways with new content from *_api_payload.json files.
"""

import json
import subprocess
import os

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

# Existing pathway IDs - using CONTEXTUAL files (34 nodes, 57 edges)
PATHWAYS = {
    "Chiropractors": {
        "id": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
        "file": "Chiropractors_contextual.json"
    },
    "Massage_Therapists": {
        "id": "d202aad7-bcb6-478c-a211-b00877545e05",
        "file": "Massage_Therapists_contextual.json"
    },
    "Naturopaths": {
        "id": "1d07d635-147e-4f69-a4cd-c124b33b073d",
        "file": "Naturopaths_contextual.json"
    },
    "Functional_Medicine": {
        "id": "236dbd85-c74d-4774-a7af-4b5812015c68",
        "file": "Functional_Medicine_contextual.json"
    },
    "Acupuncturists": {
        "id": "154f93f4-54a5-4900-92e8-0fa217508127",
        "file": "Acupuncturists_contextual.json"
    },
    "Integrative_Medicine": {
        "id": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
        "file": "Integrative_Medicine_contextual.json"
    }
}


def update_pathway(name: str, pathway_id: str, json_file: str):
    """Update an existing pathway with new content."""
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, json_file)
    
    print(f"\n{'='*60}")
    print(f"Updating: {name}")
    print(f"{'='*60}")
    
    if not os.path.exists(file_path):
        print(f"  ✗ File not found: {json_file}")
        return False
    
    # Load the updated payload
    with open(file_path, 'r') as f:
        payload = json.load(f)
    
    nodes = payload.get('nodes', [])
    edges = payload.get('edges', [])
    global_prompt = payload.get('global_prompt', '')
    
    # Verify structure
    print(f"  Nodes: {len(nodes)}")
    print(f"  Edges: {len(edges)}")
    print(f"  Global prompt length: {len(global_prompt)} chars")
    
    # Check for practitioner context (contextual files use prompts, not global_prompt)
    first_node_prompt = nodes[0].get('data', {}).get('prompt', '') if nodes else ''
    if "PRACTITIONER CONTEXT" in first_node_prompt:
        print(f"  ✓ Practitioner context present in prompts")
    else:
        print(f"  ⚠️ May be missing practitioner context")
    
    # Verify edge labels exist
    labeled_edges = sum(1 for e in edges if e.get('label') or e.get('data', {}).get('label'))
    print(f"  Edges with labels: {labeled_edges}")
    
    # Show product presentation check (contextual files have separate product nodes)
    product_nodes = [n for n in nodes if 'Present:' in n.get('data', {}).get('name', '')]
    if product_nodes:
        print(f"  ✓ Found {len(product_nodes)} product presentation nodes")
    else:
        print(f"  ⚠️ No product presentation nodes found")
    
    # Write payload to temp file
    temp_file = f"/tmp/deploy_{name}.json"
    with open(temp_file, 'w') as f:
        json.dump(payload, f)
    
    # Update the main pathway
    print(f"\n  Deploying to pathway {pathway_id}...")
    
    cmd1 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{temp_file}'''
    
    result1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    # Update version 1 specifically (required for UI visibility)
    cmd2 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{temp_file}'''
    
    result2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    # Clean up temp file
    os.remove(temp_file)
    
    # Check results
    try:
        r1 = json.loads(result1.stdout) if result1.stdout else {}
        r2 = json.loads(result2.stdout) if result2.stdout else {}
        
        error1 = r1.get('error') or r1.get('message')
        error2 = r2.get('error') or r2.get('message')
        
        success1 = r1.get('status') == 'success' or not error1
        success2 = r2.get('status') == 'success' or not error2
        
        if success1 and success2:
            print(f"  ✓ Updated successfully!")
            return True
        else:
            if error1:
                print(f"  Main pathway response: {error1}")
            if error2:
                print(f"  Version 1 response: {error2}")
            # Sometimes the API returns OK without explicit success status
            if "error" not in result1.stdout.lower() and "error" not in result2.stdout.lower():
                print(f"  ✓ Probably updated (no errors)")
                return True
            return False
    except json.JSONDecodeError:
        # Check for curl errors
        if result1.stderr or result2.stderr:
            print(f"  ✗ Curl error: {result1.stderr or result2.stderr}")
            return False
        # If no JSON response but no error, it might be OK
        print(f"  Response 1: {result1.stdout[:200] if result1.stdout else 'empty'}")
        print(f"  Response 2: {result2.stdout[:200] if result2.stdout else 'empty'}")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def main():
    print("="*60)
    print("DEPLOYING UPDATED PATHWAYS TO BLAND.AI")
    print("="*60)
    print("\nThis script updates existing pathways with the new content")
    print("including product presentations and key talking points.")
    
    results = {}
    
    for name, info in PATHWAYS.items():
        success = update_pathway(name, info['id'], info['file'])
        results[name] = success
    
    print("\n" + "="*60)
    print("DEPLOYMENT SUMMARY")
    print("="*60)
    
    for name, success in results.items():
        status = "✓" if success else "✗"
        print(f"  {status} {name}")
    
    success_count = sum(1 for v in results.values() if v)
    print(f"\nTotal: {success_count}/{len(results)} pathways updated")
    
    if success_count == len(results):
        print("\n🚀 All pathways deployed successfully!")
    else:
        print("\n⚠️ Some pathways failed to deploy. Check errors above.")


if __name__ == "__main__":
    main()
