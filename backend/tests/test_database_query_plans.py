"""Unforced PostgreSQL plans on synthetic tenant-partitioned local data.

Measures actual repository query shapes, not production capacity. No planner
settings are changed; ANALYZE only runs in the dedicated disposable fixture DB.
"""
import json
from uuid import uuid4

import pytest
from test_postgres_rls import database as database


@pytest.fixture(scope="module")
def representative(database):
    owners = [str(uuid4()) for _ in range(20)]
    values = ",".join(f"('{owner}','query-{owner}@test.local')" for owner in owners)
    database(f"INSERT INTO auth.users(id,email) VALUES {values};")
    for owner in owners:
        database(f"""
            INSERT INTO study_sets(user_id,title,created_at)
            SELECT '{owner}','Synthetic set '||n, now()-n*interval '1 minute'
            FROM generate_series(1,200) n;
            WITH sources AS MATERIALIZED (SELECT gen_random_uuid() AS id FROM generate_series(1,10))
            INSERT INTO documents(id,user_id,original_filename,file_type,mime_type,file_size,
                                  s3_object_key,expires_at,processing_status,page_count)
            SELECT id,'{owner}','Synthetic source.txt','txt','text/plain',100,
                   'documents/{owner}/'||id||'/original.txt',now()+interval '3 days','READY',10
            FROM sources;
            INSERT INTO chat_sessions(user_id,title) VALUES ('{owner}','Synthetic chat');
            INSERT INTO chat_messages(session_id,user_id,role,content)
            SELECT s.id,'{owner}','user','Synthetic message'
            FROM chat_sessions s CROSS JOIN generate_series(1,1000)
            WHERE s.user_id='{owner}';
        """, role="service_role")
        database(f"""
            INSERT INTO internal.upload_tickets(id,user_id,auth_ref,object_key,file_type,mime_type,
                file_size,provider,bucket,signed_until)
            SELECT id,'{owner}','{owner}','documents/{owner}/'||id||'/original.txt',
                'txt','text/plain',100,'supabase','documents',now()+interval '1 hour'
            FROM (SELECT gen_random_uuid() AS id FROM generate_series(1,1000)) issued;
        """, role="service_role")
    database("""
        INSERT INTO study_items(user_id,study_set_id,type,question,answer,difficulty,order_index)
        SELECT s.user_id,s.id,'flashcard','Synthetic Q','Synthetic A','medium',n
        FROM study_sets s CROSS JOIN generate_series(0,4) n;
        INSERT INTO document_chunks(user_id,document_id,chunk_index,content)
        SELECT d.user_id,d.id,n,'Synthetic evidence'
        FROM documents d CROSS JOIN generate_series(0,99) n;
        ANALYZE study_sets; ANALYZE study_items; ANALYZE document_chunks;
        ANALYZE chat_messages; ANALYZE internal.upload_tickets;
    """)
    owner = owners[0]
    set_id = database(f"SELECT id FROM study_sets WHERE user_id='{owner}' LIMIT 1;")
    document = database(f"SELECT id FROM documents WHERE user_id='{owner}' LIMIT 1;")
    return owner, set_id, document


def nodes(plan):
    yield plan
    for child in plan.get("Plans", []):
        yield from nodes(child)


@pytest.mark.parametrize("shape", ["library", "items", "chunks"])
def test_owner_query_uses_index_without_forcing_planner(database, representative, shape):
    owner, set_id, document = representative
    queries = {
        "library": (f"SELECT * FROM study_sets WHERE user_id='{owner}' ORDER BY created_at DESC,id LIMIT 50 OFFSET 0", 50, "study_sets_owner_created_idx"),
        "items": (f"SELECT * FROM study_items WHERE study_set_id='{set_id}' AND user_id='{owner}' ORDER BY order_index", 5, "items_set_order_idx"),
        "chunks": (f"SELECT * FROM document_chunks WHERE document_id='{document}' AND user_id='{owner}'", 100, "chunks_owner_document_idx"),
    }
    query, expected_rows, expected_index = queries[shape]
    result = json.loads(database(f"EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) {query};"))[0]
    plan = result["Plan"]
    used = list(nodes(plan))
    assert plan["Actual Rows"] == expected_rows
    assert any(n.get("Index Name") == expected_index for n in used), result
    assert not any(n["Node Type"] == "Seq Scan" for n in used), result
    # Broad buffer ceiling verifies subset access without asserting machine speed.
    assert plan.get("Shared Hit Blocks", 0) + plan.get("Shared Read Blocks", 0) < 1000, result
    print(json.dumps({"shape": shape, "rows": expected_rows, "index": expected_index,
                      "execution_ms": result["Execution Time"],
                      "shared_blocks": plan.get("Shared Hit Blocks", 0) + plan.get("Shared Read Blocks", 0)}))


@pytest.mark.parametrize("table,index,role", [
    ("chat_messages", "chat_messages_owner_idx", "service_role"),
    ("study_items", "study_items_owner_idx", "service_role"),
    ("internal.upload_tickets", "upload_tickets_auth_ref_idx", "service_role"),
])
def test_auth_cleanup_lookup_uses_owner_index(database, representative, table, index, role):
    owner, _, _ = representative
    column = "auth_ref" if table.endswith("upload_tickets") else "user_id"
    result = json.loads(database(
        f"EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM {table} WHERE {column}='{owner}';",
        role=role,
    ))[0]
    plan = result["Plan"]
    assert plan["Actual Rows"] == 1000, result
    assert any(node.get("Index Name") == index for node in nodes(plan)), result
    print(json.dumps({"shape": f"auth_cleanup_{table}", "rows": 1000, "index": index,
                      "execution_ms": result["Execution Time"],
                      "shared_blocks": plan.get("Shared Hit Blocks", 0) + plan.get("Shared Read Blocks", 0)}))
