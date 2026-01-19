#!/usr/bin/env python3
"""
Restore pathways from the expanded JSON files with proper edge labels.
The edge labels tell the AI when to route to each destination node.
"""

import json
import subprocess
import os

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

# Pathway IDs for each practitioner (from original deployment)
PATHWAY_IDS = {
    "Chiropractors": "cf2233ef-7fb2-49ff-af29-0eee47204e9f",
    "Massage Therapists": "9c1e63bb-f2b8-4cc4-9acd-2bc2ddb08a89",
    "Physical Therapists": "f78611af-f2c0-43af-8ddd-e7e1d2dae8e1",
    "Acupuncturists": "f1e07830-26da-48de-b43b-b2e47bfa18e3",
    "Naturopaths": "6e3a9614-9e7c-44e5-871f-a8d2ff2ce1ef",
    "Functional Medicine": "77e35cee-4dcc-4b5b-8b87-c3aafa8ad155"
}

# File names for expanded pathways
PATHWAY_FILES = {
    "Chiropractors": "Chiropractors_expanded.json",
    "Massage Therapists": "Massage_Therapists_expanded.json",
    "Physical Therapists": "Physical_Therapists_expanded.json",
    "Acupuncturists": "Acupuncturists_expanded.json",
    "Naturopaths": "Naturopaths_expanded.json",
    "Functional Medicine": "Functional_Medicine_expanded.json"
}

def restore_pathway(name: str, pathway_id: str, file_path: str):
    """Restore a pathway from its expanded JSON file."""
    print(f"\n{'='*60}")
    print(f"Restoring: {name}")
    print(f"{'='*60}")
    
    # Load the original expanded pathway
    with open(file_path, 'r') as f:
        pathway_data = json.load(f)
    
    nodes = pathway_data.get('nodes', [])
    edges = pathway_data.get('edges', [])
    
    print(f"  Nodes: {len(nodes)}")
    print(f"  Edges: {len(edges)}")
    
    # Check edge labels
    labeled = sum(1 for e in edges if e.get('data', {}).get('label'))
    print(f"  Edges with labels: {labeled}")
    
    # Prepare payload
    payload = {
        "name": f"SuperPatch - {name} Sales",
        "description": f"Outbound sales pathway for {name}",
        "nodes": nodes,
        "edges": edges
    }
    
    # Update main pathway
    payload_file = f"/tmp/restore_{name.replace(' ', '_')}.json"
    with open(payload_file, 'w') as f:
        json.dump(payload, f)
    
    # Update version 1
    cmd = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{payload_file}'''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    try:
        response = json.loads(result.stdout)
        if response.get('status') == 'success' or 'pathway_id' in response:
            print(f"  ✓ Restored successfully")
        else:
            print(f"  ✗ Response: {result.stdout[:200]}")
    except:
        print(f"  Response: {result.stdout[:200]}")
    
    # Clean up
    os.remove(payload_file)

def verify_pathway(name: str, pathway_id: str):
    """Verify edge labels are restored."""
    cmd = f'''curl -s -X GET "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "authorization: {API_KEY}"'''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    
    edges = data.get('edges', [])
    labeled = sum(1 for e in edges if e.get('data', {}).get('label'))
    
    print(f"\n{name}: {labeled}/{len(edges)} edges have labels")
    
    # Show intro edges
    intro_edges = [e for e in edges if e.get('source') == '1']
    print("  Introduction edges:")
    for e in intro_edges:
        label = e.get('data', {}).get('label', 'NO LABEL')
        target = e.get('target')
        print(f"    -> {target}: \"{label}\"")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("="*60)
    print("RESTORING PATHWAYS WITH EDGE LABELS")
    print("="*60)
    
    for name, pathway_id in PATHWAY_IDS.items():
        file_name = PATHWAY_FILES[name]
        file_path = os.path.join(script_dir, file_name)
        
        if os.path.exists(file_path):
            restore_pathway(name, pathway_id, file_path)
        else:
            print(f"\n⚠️  File not found: {file_path}")
    
    print("\n" + "="*60)
    print("VERIFYING EDGE LABELS")
    print("="*60)
    
    for name, pathway_id in PATHWAY_IDS.items():
        verify_pathway(name, pathway_id)
    
    print("\n✓ Restoration complete!")

if __name__ == "__main__":
    main()
