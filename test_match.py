import requests
import json

BASE = "http://127.0.0.1:5001/lattice-2026/us-central1"

def call(fn_name, data=None):
    """Call a Firebase callable function."""
    url = f"{BASE}/{fn_name}"
    payload = {"data": data or {}}
    print(f"\n{'='*60}")
    print(f"CALLING: {fn_name}")
    print(f"{'='*60}")
    try:
        resp = requests.post(url, json=payload, timeout=60)
        print(f"Status: {resp.status_code}")
        result = resp.json()
        print(json.dumps(result, indent=2)[:2000])  # Truncate long output
        return result
    except Exception as e:
        print(f"Error: {e}")
        return None

# --- Test 1: Dashboard Stats (no AI, fast) ---
call("get_dashboard_stats")

# --- Test 2: AI Profile Summary ---
call("summarise_company_profile", {"companyId": "comp-3"})

# --- Test 3: Generate matches for a single company ---
call("generate_matches_for_company", {"companyId": "comp-5"})

print("\n\nAll tests complete!")
