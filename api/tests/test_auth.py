"""Auth: onboarding sekali-sekali, auto-upsert Clerk, webhook Svix."""

from __future__ import annotations

import base64
import json
import time

from conftest import make_user
from api.core.auth.svix import compute_signature, decode_secret
from api.core.config import get_settings
from api.core.enums import UserRole


def test_onboard_sets_role_once(client, login_as, db):
    from api.core.models.user import User

    login_as(None)  # belum punya peran

    first = client.post("/api/auth/onboard", json={"role": "guru"})
    assert first.status_code == 200
    assert first.json()["role"] == UserRole.GURU.value

    second = client.post("/api/auth/onboard", json={"role": "murid"})
    assert second.status_code == 400

    with db() as session:
        guru_rows = session.query(User).filter_by(role=UserRole.GURU.value).count()
        assert guru_rows >= 1


def test_onboard_requires_login(client):
    assert client.post("/api/auth/onboard", json={"role": "guru"}).status_code == 401


def test_onboard_rejects_unknown_role(client, login_as):
    login_as(None)
    assert client.post("/api/auth/onboard", json={"role": "admin"}).status_code == 422


def test_murid_without_onboard_can_use_murid_routes(client, login_as, guru, db):
    from conftest import make_tugas

    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(None)  # role NULL -> diperlakukan sebagai Murid

    assert client.post("/api/sessions", json={"tugas_id": tugas.id}).status_code == 201
    # Akun universal: route Guru juga bisa dibuka login apa pun.
    assert client.get("/api/tugas").status_code == 200


def test_upsert_user_creates_row_once(client, db):
    from api.core.auth.clerk import ClerkIdentity, upsert_user
    from api.core.models.user import User

    identity = ClerkIdentity(clerk_id="user_abc", name="Budi", email="budi@x.test")
    with db() as session:
        first = upsert_user(session, identity)
        assert first.id
        second = upsert_user(session, identity)
        assert second.id == first.id
        assert second.name == "Budi"
        assert session.query(User).filter_by(clerk_id="user_abc").count() == 1


def test_upsert_user_honours_public_metadata_role(client, db):
    from api.core.auth.clerk import ClerkIdentity, upsert_user

    with db() as session:
        user = upsert_user(
            session,
            ClerkIdentity(clerk_id="user_meta", public_metadata={"role": "guru"}),
        )
        assert user.role == UserRole.GURU.value

        # Peran yang sudah dikunci tidak ditimpa metadata.
        again = upsert_user(
            session,
            ClerkIdentity(clerk_id="user_meta", public_metadata={"role": "murid"}),
        )
        assert again.role == UserRole.GURU.value


# --- webhook ---------------------------------------------------------------- #
def sign_headers(body: bytes, secret: str, svix_id: str = "msg_1") -> dict[str, str]:
    timestamp = str(int(time.time()))
    key = decode_secret(secret)
    signature = compute_signature(key, svix_id, timestamp, body)
    return {
        "svix-id": svix_id,
        "svix-timestamp": timestamp,
        "svix-signature": f"v1,{signature}",
        "content-type": "application/json",
    }


def test_webhook_rejects_bad_signature(client):
    body = json.dumps({"type": "user.created", "data": {"id": "user_x"}}).encode()
    response = client.post(
        "/api/webhooks/clerk",
        content=body,
        headers={
            "svix-id": "msg_1",
            "svix-timestamp": str(int(time.time())),
            "svix-signature": "v1,bukan-signature-yang-sah",
        },
    )
    assert response.status_code == 401


def test_webhook_rejects_stale_timestamp(client):
    secret = get_settings().clerk_webhook_secret
    body = json.dumps({"type": "user.created", "data": {"id": "user_x"}}).encode()
    timestamp = str(int(time.time()) - 3600)
    key = decode_secret(secret)
    signature = compute_signature(key, "msg_1", timestamp, body)
    response = client.post(
        "/api/webhooks/clerk",
        content=body,
        headers={
            "svix-id": "msg_1",
            "svix-timestamp": timestamp,
            "svix-signature": f"v1,{signature}",
        },
    )
    assert response.status_code == 401


def test_webhook_user_created_and_deleted(client, db):
    from api.core.models.user import User

    secret = get_settings().clerk_webhook_secret
    payload = {
        "type": "user.created",
        "data": {
            "id": "user_webhook",
            "first_name": "Siti",
            "last_name": "Nur",
            "primary_email_address_id": "e1",
            "email_addresses": [{"id": "e1", "email_address": "siti@x.test"}],
            "public_metadata": {"role": "guru"},
        },
    }
    body = json.dumps(payload).encode()

    created = client.post("/api/webhooks/clerk", content=body, headers=sign_headers(body, secret))
    assert created.status_code == 200

    with db() as session:
        user = session.query(User).filter_by(clerk_id="user_webhook").one()
        assert user.name == "Siti Nur"
        assert user.email == "siti@x.test"
        assert user.role == UserRole.GURU.value

    deleted_body = json.dumps({"type": "user.deleted", "data": {"id": "user_webhook"}}).encode()
    removed = client.post(
        "/api/webhooks/clerk", content=deleted_body, headers=sign_headers(deleted_body, secret)
    )
    assert removed.status_code == 200

    with db() as session:
        assert session.query(User).filter_by(clerk_id="user_webhook").count() == 0


def test_webhook_ignores_unrelated_event(client):
    secret = get_settings().clerk_webhook_secret
    body = json.dumps({"type": "session.created", "data": {"id": "s1"}}).encode()

    response = client.post("/api/webhooks/clerk", content=body, headers=sign_headers(body, secret))

    assert response.status_code == 200
    assert response.json() == {"status": "ignored", "type": "session.created"}


def test_decoded_secret_roundtrip():
    raw = base64.b64encode(b"kunci-rahasia").decode()
    assert decode_secret(f"whsec_{raw}") == b"kunci-rahasia"


def test_make_user_default_is_murid(client):
    assert make_user().role == UserRole.MURID.value


class _noop:
    def __enter__(self):
        return None

    def __exit__(self, *args):
        return False