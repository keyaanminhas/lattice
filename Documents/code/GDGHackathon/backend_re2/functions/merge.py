import re

with open('c:/Users/Keyaan/Documents/code/GDGHackathon/dev2/functions/main.py', 'r', encoding='utf-8') as f:
    dev2 = f.read()

with open('c:/Users/Keyaan/Documents/code/GDGHackathon/dev3/functions/main.py', 'r', encoding='utf-8') as f:
    dev3 = f.readlines()

# Extract lines 47-276 from dev3 (0-indexed: 46 to 276)
auth_funcs = ''.join(dev3[46:276])

# Insert auth_funcs into dev2 right after _init_firebase
insert_pos = dev2.find('def _get_genai_client():')
if insert_pos == -1:
    print('Could not find insert pos')
else:
    merged = dev2[:insert_pos] + auth_funcs + '\n\n' + dev2[insert_pos:]
    
    # Now add the security checks to the endpoints
    merged = merged.replace(
        'def recommend_programmes_for_startup(req: https_fn.CallableRequest):\n    db = _init_firebase()\n    data = _require_data(req)',
        'def recommend_programmes_for_startup(req: https_fn.CallableRequest):\n    db = _init_firebase()\n    account = _require_account(req, db)\n    data = _require_data(req)'
    )
    merged = merged.replace(
        'startup_id = _require_string(data, "startupId")',
        'startup_id = _require_string(data, "startupId")\n    _require_startup_owner_or_admin(account, startup_id)'
    )
    
    merged = merged.replace(
        'def recommend_contributor_to_programmes(req: https_fn.CallableRequest):\n    db = _init_firebase()\n    data = _require_data(req)',
        'def recommend_contributor_to_programmes(req: https_fn.CallableRequest):\n    db = _init_firebase()\n    _require_admin(req, db)\n    data = _require_data(req)'
    )
    
    merged = merged.replace(
        'def recommend_mentors_for_startup(req: https_fn.CallableRequest):\n    db = _init_firebase()\n    data = _require_data(req)',
        'def recommend_mentors_for_startup(req: https_fn.CallableRequest):\n    db = _init_firebase()\n    _require_admin(req, db)\n    data = _require_data(req)'
    )

    with open('c:/Users/Keyaan/Documents/code/GDGHackathon/lattice_repo/functions/main.py', 'w', encoding='utf-8') as f:
        f.write(merged)
        print('Merged successfully')
