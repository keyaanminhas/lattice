#!/usr/bin/env python3
"""Create/repair critical Lattice live logins and role assignments."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ID = "lattice-2026"
WEB_API_KEY = "AIzaSyDkpYdiPm9uwVGPnXTDqIjkyrFLj0GOgfI"
FIRESTORE_BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"
IDENTITY_TOOLKIT_BASE = "https://identitytoolkit.googleapis.com/v1"
TOKEN_CONFIG_PATH = Path.home() / ".config" / "configstore" / "firebase-tools.json"


@dataclass(frozen=True)
class LoginTarget:
    label: str
    email: str
    password: str
    display_name: str
    role_key: str
    account_type: str
    entity_type: str
    entity_id: str
    assignment_scope_type: str
    assignment_scope_id: str
    assignment_id: str
    organisation_id: str | None = None
    programme_id: str | None = None


TARGETS: list[LoginTarget] = [
    LoginTarget(
        label="Platform Admin",
        email="platform.admin@lattice.demo",
        password="Lattice2026!platform",
        display_name="Lattice Platform Admin",
        role_key="platform_admin",
        account_type="platform_admin",
        entity_type="platform",
        entity_id="lattice-platform",
        assignment_scope_type="platform",
        assignment_scope_id=PROJECT_ID,
        assignment_id="ra-platform-admin-platform-admin-lattice-2026",
    ),
    LoginTarget(
        label="Programme Admin (prog-1)",
        email="programme.admin.prog-1@lattice.demo",
        password="Lattice2026!prog-1-admin",
        display_name="Programme Admin - AI Startup Accelerator 2026",
        role_key="programme_admin",
        account_type="programme_admin",
        entity_type="programme",
        entity_id="prog-1",
        assignment_scope_type="programme",
        assignment_scope_id="prog-1",
        assignment_id="ra-programme-admin-prog-1",
        organisation_id="org-1",
        programme_id="prog-1",
    ),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_access_token() -> str:
    if not TOKEN_CONFIG_PATH.exists():
        raise RuntimeError(f"Missing Firebase CLI token file: {TOKEN_CONFIG_PATH}")
    config = json.loads(TOKEN_CONFIG_PATH.read_text(encoding="utf-8"))
    token = (config.get("tokens") or {}).get("access_token")
    if not token:
        raise RuntimeError("No Firebase CLI access token found. Run `firebase login` first.")
    return token


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: dict | None = None,
) -> dict:
    body = None
    final_headers = dict(headers or {})
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        final_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=final_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed: {exc.code} {detail}") from exc


def lookup_auth_user_by_email(email: str, token: str) -> dict | None:
    response = request_json(
        f"{IDENTITY_TOOLKIT_BASE}/projects/{PROJECT_ID}/accounts:lookup",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "x-goog-user-project": PROJECT_ID},
        payload={"email": [email]},
    )
    users = response.get("users", [])
    return users[0] if users else None


def create_auth_user(email: str, password: str) -> str:
    response = request_json(
        f"{IDENTITY_TOOLKIT_BASE}/accounts:signUp?key={WEB_API_KEY}",
        method="POST",
        payload={"email": email, "password": password, "returnSecureToken": False},
    )
    return response["localId"]


def update_auth_user(local_id: str, target: LoginTarget, token: str):
    request_json(
        f"{IDENTITY_TOOLKIT_BASE}/projects/{PROJECT_ID}/accounts:update",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "x-goog-user-project": PROJECT_ID},
        payload={
            "localId": local_id,
            "email": target.email,
            "password": target.password,
            "displayName": target.display_name,
            "emailVerified": True,
            "disableUser": False,
        },
    )


def ensure_auth_user(target: LoginTarget, token: str) -> tuple[str, str]:
    user = lookup_auth_user_by_email(target.email, token)
    if user:
        update_auth_user(user["localId"], target, token)
        return user["localId"], "updated"

    try:
        local_id = create_auth_user(target.email, target.password)
    except RuntimeError as exc:
        if "EMAIL_EXISTS" not in str(exc):
            raise
        user = lookup_auth_user_by_email(target.email, token)
        if not user:
            raise RuntimeError(f"Auth account exists but cannot be looked up for {target.email}") from exc
        local_id = user["localId"]
    update_auth_user(local_id, target, token)
    return local_id, "created"


def firestore_patch(doc_path: str, fields: dict, token: str):
    query = urllib.parse.urlencode([("currentDocument.exists", "true")])
    url = f"{FIRESTORE_BASE}/{doc_path}?{query}"
    request_json(
        url,
        method="PATCH",
        headers={"Authorization": f"Bearer {token}"},
        payload={"fields": fields},
    )


def firestore_upsert(doc_path: str, fields: dict, token: str):
    url = f"{FIRESTORE_BASE}/{doc_path}"
    request_json(
        url,
        method="PATCH",
        headers={"Authorization": f"Bearer {token}"},
        payload={"fields": fields},
    )


def s(value: str) -> dict:
    return {"stringValue": value}


def ts(value: str) -> dict:
    return {"timestampValue": value}


def ensure_account_document(uid: str, target: LoginTarget, token: str):
    timestamp = now_iso()
    fields = {
        "id": s(uid),
        "accountType": s(target.account_type),
        "roleKey": s(target.role_key),
        "requestedRoleKey": s(target.role_key),
        "entityType": s(target.entity_type),
        "entityId": s(target.entity_id),
        "displayName": s(target.display_name),
        "email": s(target.email),
        "status": s("Active"),
        "createdAt": ts(timestamp),
        "updatedAt": ts(timestamp),
        "lastLoginAt": ts(timestamp),
    }
    firestore_upsert(f"accounts/{uid}", fields, token)


def ensure_role_assignment(uid: str, target: LoginTarget, token: str):
    timestamp = now_iso()
    fields = {
        "id": s(target.assignment_id),
        "uid": s(uid),
        "roleKey": s(target.role_key),
        "scopeType": s(target.assignment_scope_type),
        "scopeId": s(target.assignment_scope_id),
        "status": s("active"),
        "isSeeded": {"booleanValue": False},
        "createdByUid": s("bootstrap_live_logins"),
        "approvedByUid": s("bootstrap_live_logins"),
        "createdAt": ts(timestamp),
        "updatedAt": ts(timestamp),
    }
    if target.organisation_id:
        fields["organisationId"] = s(target.organisation_id)
    if target.programme_id:
        fields["programmeId"] = s(target.programme_id)
    firestore_upsert(f"roleAssignments/{target.assignment_id}", fields, token)


def main():
    token = load_access_token()
    print(f"Provisioning {len(TARGETS)} critical login(s) in {PROJECT_ID}...")
    for target in TARGETS:
        uid, action = ensure_auth_user(target, token)
        ensure_account_document(uid, target, token)
        ensure_role_assignment(uid, target, token)
        print(f"- {target.label}: {target.email} ({action}, uid={uid})")
    print("Done.")


if __name__ == "__main__":
    main()
