import csv
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

PROJECT_ID = "lattice-2026"
WEB_API_KEY = "AIzaSyDkpYdiPm9uwVGPnXTDqIjkyrFLj0GOgfI"
FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"
IDENTITY_TOOLKIT_BASE = "https://identitytoolkit.googleapis.com/v1"
MAX_REQUEST_ATTEMPTS = 5
RETRYABLE_STATUS_CODES = {408, 409, 429, 500, 502, 503, 504}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_access_token() -> str:
    return subprocess.check_output(["cmd", "/c", "gcloud auth print-access-token"], text=True).strip()


def request_json(url: str, method: str = "GET", headers: dict | None = None, payload: dict | None = None) -> dict:
    encoded = None
    final_headers = dict(headers or {})
    if payload is not None:
        encoded = json.dumps(payload).encode("utf-8")
        final_headers["Content-Type"] = "application/json"

    last_error = None
    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        request = urllib.request.Request(url, data=encoded, method=method, headers=final_headers)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code in RETRYABLE_STATUS_CODES and attempt < MAX_REQUEST_ATTEMPTS:
                time.sleep(min(2 ** (attempt - 1), 10))
                continue
            raise RuntimeError(f"{method} {url} failed: {exc.code} {body}") from exc
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt < MAX_REQUEST_ATTEMPTS:
                time.sleep(min(2 ** (attempt - 1), 10))
                continue
            raise RuntimeError(f"{method} {url} failed after {MAX_REQUEST_ATTEMPTS} attempts: {exc}") from exc
    raise RuntimeError(f"{method} {url} failed: {last_error}")


def firestore_value_to_python(value: dict):
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "nullValue" in value:
        return None
    if "arrayValue" in value:
        return [firestore_value_to_python(item) for item in value.get("arrayValue", {}).get("values", [])]
    if "mapValue" in value:
        fields = value.get("mapValue", {}).get("fields", {})
        return {key: firestore_value_to_python(item) for key, item in fields.items()}
    return None


def python_to_firestore_value(value):
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if value is None:
        return {"nullValue": None}
    if isinstance(value, list):
        return {"arrayValue": {"values": [python_to_firestore_value(item) for item in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {key: python_to_firestore_value(item) for key, item in value.items()}}}
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", value):
        return {"timestampValue": value}
    return {"stringValue": str(value)}


def python_to_firestore_fields(data: dict) -> dict:
    return {key: python_to_firestore_value(value) for key, value in data.items()}


def list_collection(collection_name: str) -> list[dict]:
    token = get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    documents = []
    next_page_token = None

    while True:
        params = {"pageSize": 500}
        if next_page_token:
            params["pageToken"] = next_page_token
        url = f"{FIRESTORE_BASE}/{collection_name}?{urllib.parse.urlencode(params)}"
        response = request_json(url, headers=headers)
        for document in response.get("documents", []):
            fields = {
                key: firestore_value_to_python(value)
                for key, value in document.get("fields", {}).items()
            }
            fields["_documentName"] = document["name"]
            documents.append(fields)
        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break

    return documents


def patch_document(document_path: str, fields: dict, update_mask_fields: list[str] | None = None):
    token = get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    query_items = []
    if update_mask_fields:
        for field in update_mask_fields:
            query_items.append(("updateMask.fieldPaths", field))
    query_string = f"?{urllib.parse.urlencode(query_items)}" if query_items else ""
    url = f"{FIRESTORE_BASE}/{document_path}{query_string}"
    payload = {"fields": python_to_firestore_fields(fields)}
    return request_json(url, method="PATCH", headers=headers, payload=payload)


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "entity"


def build_email(prefix: str, entity_id: str, display_name: str) -> str:
    return f"{prefix}.{slugify(display_name)}.{entity_id}@lattice.demo"


def build_password(entity_id: str) -> str:
    return f"Lattice2026!{entity_id}"


def lookup_auth_user_by_email(email: str) -> dict | None:
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": PROJECT_ID,
    }
    url = f"{IDENTITY_TOOLKIT_BASE}/projects/{PROJECT_ID}/accounts:lookup"
    response = request_json(url, method="POST", headers=headers, payload={"email": [email]})
    users = response.get("users", [])
    return users[0] if users else None


def update_auth_user(local_id: str, email: str, password: str, display_name: str) -> dict:
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": PROJECT_ID,
    }
    url = f"{IDENTITY_TOOLKIT_BASE}/projects/{PROJECT_ID}/accounts:update"
    payload = {
        "localId": local_id,
        "email": email,
        "password": password,
        "displayName": display_name,
        "emailVerified": True,
        "disableUser": False,
    }
    return request_json(url, method="POST", headers=headers, payload=payload)


def create_auth_user(email: str, password: str) -> dict:
    url = f"{IDENTITY_TOOLKIT_BASE}/accounts:signUp?key={WEB_API_KEY}"
    payload = {"email": email, "password": password, "returnSecureToken": False}
    return request_json(url, method="POST", payload=payload)


def ensure_auth_user(email: str, password: str, display_name: str) -> tuple[str, str]:
    existing = lookup_auth_user_by_email(email)
    if existing:
        local_id = existing["localId"]
        update_auth_user(local_id, email, password, display_name)
        return local_id, "updated"

    created = create_auth_user(email, password)
    return created["localId"], "created"


def contributor_account_kind(contributor: dict) -> str:
    contributor_types = contributor.get("contributorTypes") or []
    if "Mentor" in contributor_types or contributor.get("type") == "Mentor":
        return "mentor"
    return "contributor"


def build_targets(organisations: list[dict], companies: list[dict], contributors: list[dict]) -> list[dict]:
    targets = []
    for organisation in organisations:
        targets.append(
            {
                "scope": "organisation",
                "entityType": "organisation",
                "entityId": organisation["id"],
                "accountType": "organisation",
                "displayName": organisation["name"],
                "sourceStatus": organisation.get("status", "Active"),
                "email": build_email("org", organisation["id"], organisation["name"]),
                "password": build_password(organisation["id"]),
                "contributorTypes": [],
            }
        )

    for company in companies:
        company_name = company.get("name") or company.get("companyName") or company["id"]
        targets.append(
            {
                "scope": "startup",
                "entityType": "company",
                "entityId": company["id"],
                "accountType": "startup",
                "displayName": company_name,
                "sourceStatus": company.get("verificationStatus", "Verified"),
                "email": build_email("startup", company["id"], company_name),
                "password": build_password(company["id"]),
                "contributorTypes": [],
            }
        )

    for contributor in contributors:
        targets.append(
            {
                "scope": contributor_account_kind(contributor),
                "entityType": "contributor",
                "entityId": contributor["id"],
                "accountType": "contributor",
                "displayName": contributor["name"],
                "sourceStatus": contributor.get("status", "Verified"),
                "email": build_email("contrib", contributor["id"], contributor["name"]),
                "password": build_password(contributor["id"]),
                "contributorTypes": contributor.get("contributorTypes") or [contributor.get("type", "")],
            }
        )

    return targets


def write_account_document(uid: str, target: dict):
    account_data = {
        "id": uid,
        "accountType": target["accountType"],
        "entityType": target["entityType"],
        "entityId": target["entityId"],
        "displayName": target["displayName"],
        "email": target["email"],
        "status": "Active",
        "createdAt": now_iso(),
        "lastLoginAt": now_iso(),
    }
    patch_document(f"accounts/{uid}", account_data)


def patch_entity_document(uid: str, target: dict):
    if target["entityType"] == "contributor":
        patch_document(
            f"contributors/{target['entityId']}",
            {"authUid": uid, "status": "Verified"},
            update_mask_fields=["authUid", "status"],
        )
    elif target["entityType"] == "company":
        patch_document(
            f"companies/{target['entityId']}",
            {"authUid": uid},
            update_mask_fields=["authUid"],
        )
    elif target["entityType"] == "organisation":
        patch_document(
            f"organisations/{target['entityId']}",
            {"authUid": uid, "status": "Active"},
            update_mask_fields=["authUid", "status"],
        )


def write_credentials_csv(rows: list[dict], path: str):
    fieldnames = [
        "scope",
        "accountType",
        "entityType",
        "entityId",
        "displayName",
        "email",
        "password",
        "uid",
        "authAction",
        "accountStatus",
        "sourceStatus",
        "contributorTypes",
    ]
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            output = dict(row)
            output["contributorTypes"] = ", ".join(row.get("contributorTypes") or [])
            writer.writerow(output)


def main():
    print(f"Reading live Firestore from project {PROJECT_ID}...")
    organisations = list_collection("organisations")
    companies = list_collection("companies")
    contributors = list_collection("contributors")
    accounts = list_collection("accounts")

    print(f"Live organisations: {len(organisations)}")
    print(f"Live companies: {len(companies)}")
    print(f"Live contributors: {len(contributors)}")
    print(f"Live accounts before provisioning: {len(accounts)}")

    targets = build_targets(organisations, companies, contributors)
    provisioned = []
    action_counter = Counter()

    for index, target in enumerate(targets, start=1):
        print(f"[{index}/{len(targets)}] Provisioning {target['scope']} account for {target['displayName']} ({target['entityId']})")
        uid, auth_action = ensure_auth_user(target["email"], target["password"], target["displayName"])
        write_account_document(uid, target)
        patch_entity_document(uid, target)
        action_counter[auth_action] += 1
        provisioned.append(
            {
                **target,
                "uid": uid,
                "authAction": auth_action,
                "accountStatus": "Active",
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    csv_path = f"live_entity_accounts_{timestamp}.csv"
    write_credentials_csv(provisioned, csv_path)

    mentor_count = sum(1 for row in provisioned if row["scope"] == "mentor")
    organisation_count = sum(1 for row in provisioned if row["scope"] == "organisation")
    startup_count = sum(1 for row in provisioned if row["scope"] == "startup")
    contributor_count = sum(1 for row in provisioned if row["entityType"] == "contributor")

    print()
    print("Provisioning complete.")
    print(f"Organisations provisioned: {organisation_count}")
    print(f"Startups provisioned: {startup_count}")
    print(f"Contributors provisioned: {contributor_count}")
    print(f"Mentor contributors within that set: {mentor_count}")
    print(f"Auth users created: {action_counter['created']}")
    print(f"Auth users updated: {action_counter['updated']}")
    print(f"Credentials saved to: {csv_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Provisioning failed: {exc}", file=sys.stderr)
        sys.exit(1)
