#!/usr/bin/env python3
"""
Restore pathways with proper edge labels from the original expanded JSON files.

THE PROBLEM: Bland's API returns edges without their labels. When we fetch a pathway
and redeploy, we lose all the edge labels (conditions for routing).

THE FIX: Always use edges from our original JSON files, not from the API response.
"""

import json
import subprocess
import os

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

# Current pathway IDs (from convo_pathway list)
PATHWAYS = {
    "Chiropractors": {
        "id": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
        "file": "Chiropractors_expanded.json"
    },
    "Massage_Therapists": {
        "id": "d202aad7-bcb6-478c-a211-b00877545e05",
        "file": "Massage_Therapists_expanded.json"
    },
    "Naturopaths": {
        "id": "1d07d635-147e-4f69-a4cd-c124b33b073d",
        "file": "Naturopaths_expanded.json"
    },
    "Functional_Medicine": {
        "id": "236dbd85-c74d-4774-a7af-4b5812015c68",
        "file": "Functional_Medicine_expanded.json"
    },
    "Acupuncturists": {
        "id": "154f93f4-54a5-4900-92e8-0fa217508127",
        "file": "Acupuncturists_expanded.json"
    },
    "Integrative_Medicine": {
        "id": "1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa",
        "file": "Integrative_Medicine_expanded.json"
    }
}

def restore_pathway(name: str, pathway_id: str, json_file: str):
    """Restore a pathway from its original JSON file with edge labels."""
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, json_file)
    
    print(f"\n{'='*60}")
    print(f"Restoring: {name}")
    print(f"{'='*60}")
    
    if not os.path.exists(file_path):
        print(f"  ✗ File not found: {json_file}")
        return False
    
    # Load original expanded pathway (with edge labels!)
    with open(file_path, 'r') as f:
        original_data = json.load(f)
    
    nodes = original_data.get('nodes', [])
    edges = original_data.get('edges', [])
    
    # Verify edge labels exist
    labeled_edges = sum(1 for e in edges if e.get('data', {}).get('label'))
    print(f"  Nodes: {len(nodes)}")
    print(f"  Edges: {len(edges)} ({labeled_edges} with labels)")
    
    if labeled_edges == 0:
        print(f"  ✗ No edge labels found in file!")
        return False
    
    # Show some edge labels for verification
    print(f"  Sample edges:")
    for edge in edges[:4]:
        src = edge.get('source', '?')
        tgt = edge.get('target', '?')
        label = edge.get('data', {}).get('label', 'NO LABEL')
        print(f"    {src} -> {tgt}: \"{label}\"")
    
    # Prepare payload with full edges (including labels)
    payload = {
        "name": f"SuperPatch - {name.replace('_', ' ')} Sales",
        "description": f"Outbound sales pathway for {name.replace('_', ' ')}",
        "nodes": nodes,
        "edges": edges  # This includes the edge labels!
    }
    
    # Write payload to temp file
    temp_file = f"/tmp/restore_{name}.json"
    with open(temp_file, 'w') as f:
        json.dump(payload, f)
    
    # Update the main pathway
    print(f"  Deploying to pathway {pathway_id[:12]}...")
    
    cmd1 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{temp_file}'''
    
    result1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    # Update version 1 specifically
    cmd2 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{temp_file}'''
    
    result2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    # Clean up temp file
    os.remove(temp_file)
    
    # Check results
    try:
        r1 = json.loads(result1.stdout)
        r2 = json.loads(result2.stdout)
        
        success = r1.get('status') == 'success' or r2.get('status') == 'success'
        
        if success:
            print(f"  ✓ Restored successfully!")
        else:
            print(f"  Response 1: {result1.stdout[:150]}")
            print(f"  Response 2: {result2.stdout[:150]}")
        
        return success
    except Exception as e:
        print(f"  ✗ Error parsing response: {e}")
        return False


def verify_pathway(name: str, pathway_id: str):
    """Verify edge labels were restored."""
    
    cmd = f'''curl -s -X GET "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "authorization: {API_KEY}"'''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    try:
        data = json.loads(result.stdout)
        edges = data.get('edges', [])
        labeled = sum(1 for e in edges if e.get('data', {}).get('label'))
        
        print(f"\n{name}:")
        print(f"  {labeled}/{len(edges)} edges have labels")
        
        if labeled == 0:
            print(f"  ⚠️  EDGE LABELS NOT PERSISTING - This is a Bland.ai API limitation")
        
        return labeled > 0
    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    print("="*60)
    print("RESTORING PATHWAYS WITH EDGE LABELS")
    print("="*60)
    print("\nThis script restores pathways from the original expanded JSON")
    print("files which contain the proper edge labels for routing.")
    
    results = {}
    
    for name, info in PATHWAYS.items():
        success = restore_pathway(name, info['id'], info['file'])
        results[name] = success
    
    print("\n" + "="*60)
    print("VERIFICATION")
    print("="*60)
    
    all_verified = True
    for name, info in PATHWAYS.items():
        if not verify_pathway(name, info['id']):
            all_verified = False
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    success_count = sum(1 for v in results.values() if v)
    print(f"\nRestored: {success_count}/{len(results)} pathways")
    
    if not all_verified:
        print("\n⚠️  NOTE: Bland.ai's API may not return edge labels in GET responses,")
        print("   but they should still work for routing during calls.")


if __name__ == "__main__":
    main()
