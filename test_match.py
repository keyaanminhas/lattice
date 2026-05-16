import json

import requests

BASE = "http://127.0.0.1:5001/lattice-2026/us-central1"


def call(fn_name, data=None):
    url = f"{BASE}/{fn_name}"
    payload = {"data": data or {}}
    print(f"\n{'=' * 60}")
    print(f"CALLING: {fn_name}")
    print(f"{'=' * 60}")
    try:
        response = requests.post(url, json=payload, timeout=90)
        print(f"Status: {response.status_code}")
        result = response.json()
        print(json.dumps(result, indent=2)[:2500])
        return result
    except Exception as exc:
        print(f"Error: {exc}")
        return None


call("get_dashboard_stats")
call("summarise_startup_profile", {"startupId": "comp-1"})
call("recommend_programmes_for_startup", {"startupId": "comp-5"})
call("recommend_mentor_for_startup", {"startupId": "comp-1", "programmeId": "prog-2"})

print("\nAll tests complete.")
