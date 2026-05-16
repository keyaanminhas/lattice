import requests
import json

URL = "http://127.0.0.1:5001/lattice-2026/us-central1/generate_matches_for_company"
# Note: Ensure the project ID in the URL matches your local Firebase setup

payload = {
    "data": {
        "companyId": "comp-1"
    }
}

print("Triggering AI Relationship Matching for Company: comp-1...")

try:
    response = requests.post(URL, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("\n--- AI Match Results ---")
        print(json.dumps(result, indent=2))
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Failed to connect to emulator: {e}")
