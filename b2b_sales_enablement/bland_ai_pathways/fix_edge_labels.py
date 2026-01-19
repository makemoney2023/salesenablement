#!/usr/bin/env python3
"""
Fix edge labels by using the correct format:
- type: "custom" on each edge
- label: at TOP LEVEL (not inside data)

The wrong format:
  {"data": {"label": "..."}}  ← Labels NOT persisted by Bland

The correct format:
  {"type": "custom", "label": "..."}  ← Labels ARE persisted
"""

import json
import subprocess
import os

API_KEY = os.environ.get("BLAND_API_KEY")
if not API_KEY:
    raise ValueError("BLAND_API_KEY environment variable is required")

# Current pathway IDs
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


def convert_edge_format(edges: list) -> list:
    """
    Convert edges from wrong format to correct format.
    
    Wrong:  {"id": "e1", "source": "1", "target": "2", "data": {"label": "continue"}}
    Correct: {"id": "e1", "source": "1", "target": "2", "type": "custom", "label": "continue"}
    """
    converted = []
    for edge in edges:
        # Get the label from data.label if it exists
        label = edge.get('data', {}).get('label', '')
        if not label:
            label = edge.get('label', 'continue')  # Fallback
        
        new_edge = {
            "id": edge.get('id'),
            "source": edge.get('source'),
            "target": edge.get('target'),
            "type": "custom",
            "label": label
        }
        converted.append(new_edge)
    
    return converted


def fix_pathway(name: str, pathway_id: str, json_file: str):
    """Fix edge labels for a pathway."""
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, json_file)
    
    print(f"\n{'='*60}")
    print(f"Fixing: {name}")
    print(f"{'='*60}")
    
    if not os.path.exists(file_path):
        print(f"  ✗ File not found: {json_file}")
        return False
    
    # Load the pathway
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    nodes = data.get('nodes', [])
    edges = data.get('edges', [])
    
    print(f"  Original edges: {len(edges)}")
    
    # Convert edges to correct format
    fixed_edges = convert_edge_format(edges)
    
    # Show sample converted edges
    print(f"  Sample converted edges:")
    for edge in fixed_edges[:3]:
        print(f"    {edge['source']} -> {edge['target']}: \"{edge['label']}\"")
    
    # Prepare payload
    payload = {
        "name": f"SuperPatch - {name.replace('_', ' ')} Sales",
        "description": f"Outbound sales pathway for {name.replace('_', ' ')}",
        "nodes": nodes,
        "edges": fixed_edges
    }
    
    # Save and deploy
    temp_file = f"/tmp/fix_{name}.json"
    with open(temp_file, 'w') as f:
        json.dump(payload, f)
    
    print(f"  Deploying...")
    
    # Update main pathway
    cmd1 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{temp_file}'''
    
    r1 = subprocess.run(cmd1, shell=True, capture_output=True, text=True)
    
    # Update version 1
    cmd2 = f'''curl -s -X POST "https://api.bland.ai/v1/pathway/{pathway_id}/version/1" \
      -H "authorization: {API_KEY}" \
      -H "Content-Type: application/json" \
      -d @{temp_file}'''
    
    r2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
    
    os.remove(temp_file)
    
    try:
        res1 = json.loads(r1.stdout)
        res2 = json.loads(r2.stdout)
        success = res1.get('status') == 'success' or res2.get('status') == 'success'
        
        if success:
            print(f"  ✓ Fixed successfully!")
        else:
            print(f"  Response: {r1.stdout[:200]}")
        
        return success
    except Exception as e:
        print(f"  Error: {e}")
        return False


def verify_pathway(name: str, pathway_id: str):
    """Verify edge labels are working."""
    
    cmd = f'''curl -s "https://api.bland.ai/v1/pathway/{pathway_id}" \
      -H "authorization: {API_KEY}"'''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    try:
        data = json.loads(result.stdout)
        edges = data.get('edges', [])
        
        # Count edges with labels
        labeled = 0
        for e in edges:
            label = e.get('label') or e.get('data', {}).get('label')
            if label:
                labeled += 1
        
        print(f"\n{name}: {labeled}/{len(edges)} edges have labels")
        
        if labeled > 0:
            print(f"  ✓ Edge labels working!")
            # Show intro edges
            intro_edges = [e for e in edges if e.get('source') == '1']
            for e in intro_edges[:3]:
                label = e.get('label') or e.get('data', {}).get('label', 'NO LABEL')
                print(f"    1 -> {e.get('target')}: \"{label}\"")
        else:
            print(f"  ✗ No labels found")
        
        return labeled > 0
    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    print("="*60)
    print("FIXING EDGE LABELS WITH CORRECT FORMAT")
    print("="*60)
    print("\nUsing format: {type: 'custom', label: '...'}")
    print("This ensures Bland.ai persists the edge labels.")
    
    results = {}
    
    for name, info in PATHWAYS.items():
        success = fix_pathway(name, info['id'], info['file'])
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
    
    fixed_count = sum(1 for v in results.values() if v)
    print(f"\nFixed: {fixed_count}/{len(results)} pathways")
    
    if all_verified:
        print("\n✓ All edge labels are now working!")
        print("The voice agent should now route correctly between nodes.")
    else:
        print("\n⚠️  Some pathways may need attention.")


if __name__ == "__main__":
    main()
