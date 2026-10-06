"""Real local transaction checks using the existing guarded disposable SQL fixture."""
import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from test_postgres_rls import authenticated, document, register_sql
from test_postgres_rls import database as database
from test_postgres_rls import users as users

from app.db.repositories.chat_import_repo import import_ids


def seed(database, owner):
    source = document(owner)
    database(register_sql(source), role="service_role")
    chunk_id = str(uuid4())
    database(f"UPDATE documents SET processing_status='READY' WHERE id='{source['id']}';")
    database(f"INSERT INTO document_chunks(id,document_id,user_id,chunk_index,content,page_start,section) VALUES ('{chunk_id}','{source['id']}','{owner}',0,'Cells use ATP.',1,'Biology');")
    return source["id"], {"type": "flashcard", "question": "What do cells use?", "answer": "ATP", "difficulty": "medium",
        "source_metadata": {"document_id": source["id"], "chunk_id": chunk_id, "source_id": 1,
                            "page": 1, "section": "Biology", "snippet": "Cells use ATP."}}


def call(owner, document_id, item, title="Chat imports"):
    set_id, item_id = import_ids(owner, title, item)
    # Synthetic values only, escaped as PostgreSQL literals.
    payload = json.dumps(item).replace("'", "''")
    return f"SELECT public.persist_chat_card('{owner}','{title}','{document_id}','{set_id}','{item_id}','{payload}'::jsonb);"


def test_repeated_concurrent_imports_append_once_in_order(database, users):
    owner, _ = users
    document_id, item = seed(database, owner)
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda _: json.loads(database(call(owner, document_id, item), role="service_role")), range(16)))
    assert len({row["id"] for row in results}) == 1
    relabeled = {**item, "source_metadata": {**item["source_metadata"], "source_id": 99, "document_name": "Renamed source"}}
    assert json.loads(database(call(owner, document_id, relabeled), role="service_role"))["item_count"] == 1
    set_id = results[0]["id"]
    second = {**item, "question": "Which molecule powers cells?"}
    result = json.loads(database(call(owner, document_id, second), role="service_role"))
    assert result["item_count"] == 2
    assert database(f"SELECT string_agg(order_index::text,',' ORDER BY order_index) FROM study_items WHERE study_set_id='{set_id}';") == "0,1"
    assert database(f"SELECT count(*) FROM study_items WHERE study_set_id='{set_id}';") == "2"
    assert json.loads(database(call(owner, document_id, second), role="service_role"))["item_count"] == 2


def test_import_denies_foreign_expired_and_direct_client_calls(database, users):
    owner, other = users
    document_id, item = seed(database, owner)
    database(call(other, document_id, item), role="service_role", success=False)
    database(call(owner, document_id, item), role="anon", success=False)
    database(authenticated(owner, call(owner, document_id, item)), success=False)
    database(f"UPDATE documents SET uploaded_at=now()-interval '48 hours',expires_at=now()-interval '1 hour' WHERE id='{document_id}';")
    database(call(owner, document_id, item), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{owner}';") == "0"


def test_import_bad_item_rolls_back_new_set_and_preserves_previous_data(database, users):
    owner, _ = users
    document_id, item = seed(database, owner)
    invalid = {**item, "difficulty": "invalid"}
    database(call(owner, document_id, invalid), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{owner}';") == "0"
    saved = json.loads(database(call(owner, document_id, item), role="service_role"))
    forged = {**item, "source_metadata": {**item["source_metadata"], "chunk_id": str(uuid4())}}
    database(call(owner, document_id, forged), role="service_role", success=False)
    assert database(f"SELECT item_count FROM study_sets WHERE id='{saved['id']}';") == "1"
    assert database(f"SELECT count(*) FROM study_items WHERE study_set_id='{saved['id']}';") == "1"
    assert database("SELECT prosecdef FROM pg_proc WHERE oid='public.persist_chat_card(uuid,text,uuid,uuid,uuid,jsonb)'::regprocedure;") == "f"


def deck_call(owner, document_id, items, set_id, source_only=True):
    deck = {"title": "Chat deck", "description": "Synthetic", "generation_config": {"source_only": source_only}}
    payload = json.dumps(items).replace("'", "''")
    meta = json.dumps(deck).replace("'", "''")
    return (f"SELECT public.persist_chat_deck('{owner}','{document_id}','{set_id}',"
            f"'{meta}'::jsonb,'{payload}'::jsonb);")


def test_chat_deck_is_atomic_idempotent_and_owner_bound(database, users):
    owner, other = users
    document_id, item = seed(database, owner)
    second = {**item, "question": "Which molecule do cells use?"}
    set_id = str(uuid4())
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda _: json.loads(database(
            deck_call(owner, document_id, [item, second], set_id), role="service_role")), range(12)))
    assert {row["id"] for row in results} == {set_id}
    assert results[0]["item_count"] == 2
    assert database(f"SELECT string_agg(order_index::text,',' ORDER BY order_index) FROM study_items WHERE study_set_id='{set_id}';") == "0,1"
    # Foreign owner retrying a known set id, anonymous and authenticated clients are denied.
    database(deck_call(other, document_id, [item], set_id), role="service_role", success=False)
    database(deck_call(owner, document_id, [item], str(uuid4())), role="anon", success=False)
    database(authenticated(owner, deck_call(owner, document_id, [item], str(uuid4()))), success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{owner}';") == "1"
    assert database("SELECT prosecdef FROM pg_proc WHERE oid='public.persist_chat_deck(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure;") == "f"


def test_chat_deck_rejects_forged_evidence_and_rolls_back(database, users):
    owner, other = users
    document_id, item = seed(database, owner)
    forged_chunk = {**item, "source_metadata": {**item["source_metadata"], "chunk_id": str(uuid4())}}
    forged_snippet = {**item, "source_metadata": {**item["source_metadata"], "snippet": "Invented."}}
    bad_type = {**item, "type": "essay"}
    for items in ([item, forged_chunk], [forged_snippet], [bad_type], []):
        database(deck_call(owner, document_id, items, str(uuid4())), role="service_role", success=False)
    database(deck_call(owner, document_id, [item], str(uuid4()), source_only=False), role="service_role", success=False)
    foreign_document, foreign_item = seed(database, other)
    database(deck_call(owner, foreign_document, [foreign_item], str(uuid4())), role="service_role", success=False)
    database(f"UPDATE documents SET uploaded_at=now()-interval '48 hours',expires_at=now()-interval '1 hour' WHERE id='{document_id}';")
    database(deck_call(owner, document_id, [item], str(uuid4())), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{owner}';") == "0"
    assert database(f"SELECT count(*) FROM study_items WHERE user_id='{owner}';") == "0"


def test_foreign_item_collision_rolls_back_set_creation(database, users):
    owner, other = users
    document_id, item = seed(database, owner)
    _, conflicting_id = import_ids(owner, "Chat imports", item)
    foreign_set = str(uuid4())
    database(f"INSERT INTO study_sets(id,user_id,title) VALUES ('{foreign_set}','{other}','Foreign set');")
    database(f"INSERT INTO study_items(id,user_id,study_set_id,type,question,answer) VALUES ('{conflicting_id}','{other}','{foreign_set}','flashcard','Foreign question','Foreign answer');")
    # The function inserts the new owner set before detecting the foreign item.
    # Its exception must roll that set back and leave foreign data untouched.
    database(call(owner, document_id, item), role="service_role", success=False)
    assert database(f"SELECT count(*) FROM study_sets WHERE user_id='{owner}';") == "0"
    assert database(f"SELECT question FROM study_items WHERE id='{conflicting_id}';") == "Foreign question"
