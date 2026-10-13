"""Folder offline replays preserve owner identity and deletion tombstones."""
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx
import pytest
from fastapi import Header
from test_postgres_rls import database as database
from test_postgres_rls import users as users

from app.db.repositories.folder_repo import folder_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app


@pytest.fixture
async def client():
    async def identity(x_test_user: str = Header()):
        return AuthenticatedUser(x_test_user)
    app.dependency_overrides[get_current_user] = identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local") as value:
        yield value
    app.dependency_overrides.pop(get_current_user, None)


async def test_folder_api_concurrent_replay_scoped_and_changed_payload_rejected(client):
    owner, other, key = str(uuid4()), str(uuid4()), str(uuid4())
    headers = {"x-test-user": owner, "Idempotency-Key": key}
    responses = await asyncio.gather(*[client.post('/api/folders', headers=headers, json={"name": "  Notes  ", "color": "violet"}) for _ in range(12)])
    assert all(r.status_code == 201 for r in responses)
    ids = {r.json()['id'] for r in responses}
    assert len(ids) == 1
    denied = await client.post('/api/folders', headers=headers, json={"name": "Different"})
    assert denied.status_code == 409 and denied.json()['error']['code'] == 'IDEMPOTENCY_KEY_REUSED'
    separate = await client.post('/api/folders', headers={**headers, 'x-test-user': other}, json={"name": "Notes", "color": "violet"})
    assert separate.status_code == 201 and separate.json()['id'] not in ids
    folder_id = next(iter(ids))
    await folder_repo.update_folder(folder_id, owner, {"name": "Renamed"})
    replay = await client.post('/api/folders', headers=headers, json={"name": "Notes", "color": "violet"})
    assert replay.json()['name'] == 'Renamed'
    await folder_repo.delete_folder(folder_id, owner)
    deleted = await client.post('/api/folders', headers=headers, json={"name": "Notes", "color": "violet"})
    assert deleted.status_code == 409 and deleted.json()['error']['code'] == 'FOLDER_REQUEST_DELETED'
    assert await folder_repo.get_folder(folder_id, owner) is None


@pytest.mark.parametrize('key', ['', 'bad key', 'x' * 129])
async def test_invalid_request_key_is_safe(client, key):
    response = await client.post('/api/folders', headers={'x-test-user': str(uuid4()), 'Idempotency-Key': key}, json={'name': 'Notes'})
    assert response.status_code == 422
    assert 'bad key' not in response.text


def call(owner, key, name='Notes'):
    return f"SELECT public.create_folder_request('{owner}','{key}','{name}',NULL);"


def test_pg_folder_replay_atomic_across_instances_and_owner_scoped(database, users):
    owner, other = users
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(lambda _: json.loads(database(call(owner,key), role='service_role')), range(12)))
    assert len({r['id'] for r in rows}) == 1
    assert database(f"SELECT count(*) FROM folders WHERE user_id='{owner}';") == '1'
    assert json.loads(database(call(other,key),role='service_role'))['id'] != rows[0]['id']
    database(call(owner,key,'Different'),role='service_role',success=False)
    source = rows[0]['id']
    database(f"UPDATE folders SET name='Renamed' WHERE id='{source}';")
    assert json.loads(database(call(owner,key),role='service_role'))['name'] == 'Renamed'
    database(f"DELETE FROM folders WHERE id='{source}';")
    database(call(owner,key),role='service_role',success=False)
    assert database(f"SELECT count(*) FROM folders WHERE user_id='{owner}';") == '0'
    for role in ('anon','authenticated'):
        database(call(owner,str(uuid4())),role=role,success=False)
        database('SELECT * FROM internal.folder_requests;',role=role,success=False)


async def test_omitted_folder_color_uses_database_default_for_both_paths(client):
    owner = str(uuid4())
    headers = {"x-test-user": owner}
    unkeyed = await client.post('/api/folders', headers=headers, json={"name": "Plain"})
    keyed = await client.post('/api/folders', headers={**headers, "Idempotency-Key": str(uuid4())}, json={"name": "Replayable"})
    assert unkeyed.status_code == keyed.status_code == 201
    assert unkeyed.json()['color'] == keyed.json()['color'] == '#4F46E5'
