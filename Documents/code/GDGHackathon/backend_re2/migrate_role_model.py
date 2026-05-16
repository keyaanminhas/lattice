import firebase_admin
from firebase_admin import firestore


def init_db():
    try:
        firebase_admin.initialize_app()
    except ValueError:
        pass
    return firestore.client()


def normalise_role_key(value: str) -> str:
    key = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
    mapping = {
        "organisation": "organisation_admin",
        "organization_admin": "organisation_admin",
        "organisationadmin": "organisation_admin",
        "platformadmin": "platform_admin",
        "programmeadmin": "programme_admin",
        "technical_provider": "service_provider",
        "technicalprovider": "service_provider",
        "serviceprovider": "service_provider",
        "company": "startup",
    }
    return mapping.get(key, key)


def role_from_account_type(account_type: str) -> str:
    account_type = (account_type or "").strip().lower()
    if account_type == "organisation":
        return "organisation_admin"
    if account_type == "startup":
        return "startup"
    if account_type == "contributor":
        return "mentor"
    return "startup"


def contributor_primary_role(contributor_doc: dict) -> str:
    types = contributor_doc.get("contributorTypes") or []
    mapped = []
    for item in types:
        value = normalise_role_key(str(item))
        if value == "mentor":
            mapped.append("mentor")
        elif value == "partner":
            mapped.append("partner")
        elif value == "investor":
            mapped.append("investor")
        elif value in {"service_provider", "service_provider"}:
            mapped.append("service_provider")
    return mapped[0] if mapped else "mentor"


def ensure_role_assignment(db, assignment_id: str, payload: dict):
    db.collection("roleAssignments").document(assignment_id).set(payload, merge=True)


def main():
    db = init_db()
    accounts = list(db.collection("accounts").stream())
    contributors = {doc.id: doc.to_dict() for doc in db.collection("contributors").stream()}
    programmes = [doc.to_dict() for doc in db.collection("programmes").stream()]

    updated_accounts = 0
    seeded_assignments = 0

    for account_doc in accounts:
        data = account_doc.to_dict() or {}
        uid = account_doc.id
        role_key = normalise_role_key(data.get("roleKey"))
        if not role_key:
            role_key = role_from_account_type(data.get("accountType"))

        if data.get("accountType") == "contributor":
            contributor = contributors.get(data.get("entityId"), {})
            role_key = contributor_primary_role(contributor)

        updates = {
            "roleKey": role_key,
            "requestedRoleKey": data.get("requestedRoleKey") or role_key,
            "migrationSource": "live-2026-05-16",
            "isSeeded": bool(data.get("isSeeded", False)),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        account_doc.reference.set(updates, merge=True)
        updated_accounts += 1

        if role_key == "organisation_admin":
            assignment = {
                "id": f"ra-org-{uid}",
                "uid": uid,
                "roleKey": "organisation_admin",
                "scopeType": "organisation",
                "scopeId": data.get("entityId"),
                "organisationId": data.get("entityId"),
                "programmeId": None,
                "status": "active",
                "isSeeded": True,
                "migrationSource": "live-2026-05-16",
                "createdByUid": "migration_script",
                "approvedByUid": "migration_script",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
            ensure_role_assignment(db, assignment["id"], assignment)
            seeded_assignments += 1
        elif role_key == "startup":
            assignment = {
                "id": f"ra-startup-{uid}",
                "uid": uid,
                "roleKey": "startup",
                "scopeType": "self",
                "scopeId": data.get("entityId"),
                "organisationId": None,
                "programmeId": None,
                "status": "active",
                "isSeeded": True,
                "migrationSource": "live-2026-05-16",
                "createdByUid": "migration_script",
                "approvedByUid": "migration_script",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
            ensure_role_assignment(db, assignment["id"], assignment)
            seeded_assignments += 1
        else:
            assignment = {
                "id": f"ra-contrib-{uid}",
                "uid": uid,
                "roleKey": role_key,
                "scopeType": "self",
                "scopeId": data.get("entityId"),
                "organisationId": None,
                "programmeId": None,
                "status": "active",
                "isSeeded": True,
                "migrationSource": "live-2026-05-16",
                "createdByUid": "migration_script",
                "approvedByUid": "migration_script",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
            ensure_role_assignment(db, assignment["id"], assignment)
            seeded_assignments += 1

    for programme in programmes:
        slot_id = f"ra-programme-slot-{programme['id']}"
        payload = {
            "id": slot_id,
            "uid": None,
            "roleKey": "programme_admin",
            "scopeType": "programme",
            "scopeId": programme["id"],
            "organisationId": programme.get("organisationId"),
            "programmeId": programme["id"],
            "status": "unassigned",
            "isSeeded": True,
            "migrationSource": "live-2026-05-16",
            "createdByUid": "migration_script",
            "approvedByUid": "migration_script",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        ensure_role_assignment(db, slot_id, payload)
        seeded_assignments += 1

    print(f"Updated accounts: {updated_accounts}")
    print(f"Upserted role assignments: {seeded_assignments}")


if __name__ == "__main__":
    main()
