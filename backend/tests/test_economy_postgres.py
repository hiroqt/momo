"""Real local PostgreSQL checks for migration 005 (economy ledger).

Uses the guarded disposable loopback fixture from test_postgres_rls; skipped
unless LOCAL_TEST_DATABASE_URL names a dedicated momo_security_test database.
"""
import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import test_postgres_rls as rls
from test_postgres_rls import authenticated, seed_sets

# Re-export the guarded disposable-database fixtures for this module.
database = rls.database
users = rls.users

ECONOMY_FUNCTIONS = [
    "folder_credit_cost(integer)", "economy_lock_wallet(uuid,integer)",
    "economy_wallet_json(economy_wallets)", "get_economy_wallet(uuid,integer)",
    "apply_economy_entry(uuid,text,text,integer,bigint,bigint,uuid,uuid,integer)",
    "create_folder_with_charge(uuid,text,text,text,integer)",
]


def entry_sql(user_id, key, kind, hearts=0, credits=0, xp=0, item=None, folder=None, regen=None):
    def literal(value):
        return "NULL" if value is None else f"'{value}'"
    return (f"SELECT public.apply_economy_entry('{user_id}','{key}','{kind}',{hearts},{credits},{xp},"
            f"{literal(item)},{literal(folder)},{'NULL' if regen is None else regen});")


def folder_sql(user_id, key, name, regen=None):
    return f"SELECT public.create_folder_with_charge('{user_id}','{key}','{name}',NULL,{'NULL' if regen is None else regen});"


def wallet(database, user_id, regen=None):
    return json.loads(database(f"SELECT public.get_economy_wallet('{user_id}',{'NULL' if regen is None else regen});",
                               role="service_role"))


def attempt(database, statement):
    try:
        return json.loads(database(statement, role="service_role"))
    except AssertionError as exc:
        return str(exc)


def test_economy_tables_force_rls_and_owner_reads(database, users):
    alice, bob = users
    assert database("SELECT string_agg(relname||':'||relrowsecurity||relforcerowsecurity, ',' ORDER BY relname) FROM pg_class "
                    "WHERE relname IN ('economy_wallets','economy_ledger') AND relnamespace='public'::regnamespace;") \
        == "economy_ledger:truetrue,economy_wallets:truetrue"
    database(entry_sql(alice, "alice-key-1", "heart_loss", hearts=-1), role="service_role")
    assert database(authenticated(alice, "SELECT count(*) FROM economy_ledger")) == "1"
    assert database(authenticated(bob, f"SELECT count(*) FROM economy_wallets WHERE user_id='{alice}'")) == "0"
    assert database(authenticated(bob, f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}'")) == "0"
    database("BEGIN; SET LOCAL ROLE anon; SELECT * FROM economy_wallets; ROLLBACK;", success=False)
    database("BEGIN; SET LOCAL ROLE anon; SELECT * FROM economy_ledger; ROLLBACK;", success=False)


def test_clients_cannot_write_balances_or_call_economy_rpcs(database, users):
    alice, _ = users
    database(authenticated(alice, f"UPDATE economy_wallets SET credits=999999 WHERE user_id='{alice}'"), success=False)
    database(authenticated(alice, f"INSERT INTO economy_wallets(user_id,credits) VALUES ('{alice}',999)"), success=False)
    database(authenticated(alice, entry_sql(alice, "forged-key-1", "credit_reward", credits=500)[:-1]), success=False)
    database(authenticated(alice, folder_sql(alice, "forged-key-2", "Free")[:-1]), success=False)
    for signature in ECONOMY_FUNCTIONS:
        row = database(f"SELECT has_function_privilege('anon','public.{signature}','EXECUTE'),"
                       f"has_function_privilege('authenticated','public.{signature}','EXECUTE'),"
                       f"has_function_privilege('service_role','public.{signature}','EXECUTE'),"
                       f"'search_path=pg_catalog, public'=ANY(proconfig),prosecdef "
                       f"FROM pg_proc WHERE oid='public.{signature}'::regprocedure;")
        assert row == "f|f|t|t|f", signature


def test_prd_baseline_and_folder_formula(database, users):
    alice, _ = users
    w = wallet(database, alice)
    assert (w["hearts"], w["max_hearts"], w["credits"], w["xp"], w["next_folder_cost"]) == (5, 5, 0, 0, 0)
    costs = database("SELECT string_agg(public.folder_credit_cost(n)::text, ',' ORDER BY n) FROM generate_series(0,6) n;")
    assert costs == "0,0,0,50,75,100,125"
    database("SELECT public.folder_credit_cost(-1);", success=False)
    database(f"UPDATE economy_wallets SET hearts=6 WHERE user_id='{alice}';", success=False)
    database(f"UPDATE economy_wallets SET credits=-1 WHERE user_id='{alice}';", success=False)


def test_concurrent_heart_spend_cannot_overdraft(database, users):
    alice, _ = users
    keys = [f"heart-{uuid4()}" for _ in range(12)]
    with ThreadPoolExecutor(max_workers=12) as executor:
        outcomes = list(executor.map(lambda key: attempt(database, entry_sql(alice, key, "heart_loss", hearts=-1)), keys))
    assert sum(isinstance(o, dict) for o in outcomes) == 5
    assert all("INSUFFICIENT_HEARTS" in o for o in outcomes if isinstance(o, str))
    assert wallet(database, alice)["hearts"] == 0
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}' AND kind='heart_loss';") == "5"


def test_concurrent_credit_spend_and_replays_are_exact(database, users):
    alice, bob = users
    database(entry_sql(alice, "seed-credits-1", "credit_reward", credits=100), role="service_role")
    replay_key = "cosmetic-replayed"
    statements = [entry_sql(alice, f"cosmetic-{i}", "cosmetic_purchase", credits=-30) for i in range(6)]
    statements += [entry_sql(alice, replay_key, "cosmetic_purchase", credits=-30)] * 4
    with ThreadPoolExecutor(max_workers=10) as executor:
        outcomes = list(executor.map(lambda s: attempt(database, s), statements))
    successes = [o for o in outcomes if isinstance(o, dict)]
    applied = [o for o in successes if not o["replayed"]]
    assert len(applied) == 3  # 100 credits buy exactly three 30-credit items
    assert all("INSUFFICIENT_CREDITS" in o for o in outcomes if isinstance(o, str))
    assert wallet(database, alice)["credits"] == 10
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}' AND idempotency_key='{replay_key}';") in {"0", "1"}
    # Reusing a key for a different request fails; another tenant's identical key is independent.
    database(entry_sql(alice, "seed-credits-1", "credit_reward", credits=999), success=False, role="service_role")
    other = json.loads(database(entry_sql(bob, "seed-credits-1", "credit_reward", credits=5), role="service_role"))
    assert other["replayed"] is False and other["wallet"]["credits"] == 5
    again = json.loads(database(entry_sql(alice, "seed-credits-1", "credit_reward", credits=100), role="service_role"))
    assert again["replayed"] is True and again["wallet"]["credits"] == 10


def test_invalid_entries_are_rejected_without_side_effects(database, users):
    alice, _ = users
    for statement in [
        entry_sql(alice, "bad-1", "heart_loss", hearts=-2),
        entry_sql(alice, "bad-2", "credit_reward", credits=-5),
        entry_sql(alice, "bad-3", "folder_purchase", credits=-50),
        entry_sql(alice, "bad-4", "heart_regen", hearts=1),
        entry_sql(alice, "", "xp_reward", xp=5),
        entry_sql(alice, "bad-5", "heart_refill", hearts=1),
        entry_sql(alice, "bad-6", "heart_refill", hearts=1, credits=-10),  # full wallet
        entry_sql(alice, "bad-7", "xp_reward", xp=5, regen=5),
    ]:
        database(statement, success=False, role="service_role")
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}';") == "0"
    assert wallet(database, alice)["hearts"] == 5


def test_composite_ownership_on_ledger_references(database, users):
    alice, bob = users
    _, bob_set = seed_sets(database, users)
    bob_item = database(f"INSERT INTO study_items(study_set_id,type,question,answer) VALUES ('{bob_set}','flashcard','Q','A') RETURNING id;")
    database(entry_sql(alice, "foreign-item", "heart_loss", hearts=-1, item=bob_item), success=False, role="service_role")
    bob_folder = str(uuid4())
    database(f"INSERT INTO folders(id,user_id,name) VALUES ('{bob_folder}','{bob}','Bob only');")
    database(entry_sql(alice, "foreign-folder", "adjustment", credits=1, folder=bob_folder), success=False, role="service_role")
    database(f"INSERT INTO economy_wallets(user_id) VALUES ('{alice}') ON CONFLICT DO NOTHING; "
             f"INSERT INTO economy_ledger(user_id,idempotency_key,kind,hearts_after,credits_after,xp_after,study_item_id,request_fingerprint) "
             f"VALUES ('{alice}','direct','adjustment',5,0,0,'{bob_item}','x');", success=False)
    owned = json.loads(database(entry_sql(bob, "own-item", "heart_loss", hearts=-1, item=bob_item), role="service_role"))
    assert owned["entry"]["study_item_id"] == bob_item
    # Deleting the study material keeps the ledger entry (reference cleared, balance history intact).
    database(f"DELETE FROM study_sets WHERE id='{bob_set}';")
    assert database(f"SELECT study_item_id IS NULL FROM economy_ledger WHERE user_id='{bob}' AND idempotency_key='own-item';") == "t"


def test_heart_regeneration_time_boundaries(database, users):
    alice, _ = users
    for i in range(3):
        database(entry_sql(alice, f"loss-{i}", "heart_loss", hearts=-1), role="service_role")
    database(f"UPDATE economy_wallets SET hearts_refreshed_at=now()-interval '1199 seconds' WHERE user_id='{alice}';")
    assert wallet(database, alice)["hearts"] == 2  # no configured policy: no regeneration
    assert wallet(database, alice, regen=600)["hearts"] == 3  # exactly one full interval elapsed
    assert wallet(database, alice, regen=600)["hearts"] == 3  # remainder retained, not double counted
    database(f"UPDATE economy_wallets SET hearts_refreshed_at=now()-interval '10 days' WHERE user_id='{alice}';")
    assert wallet(database, alice, regen=600)["hearts"] == 5
    regen = database(f"SELECT sum(hearts_delta) FROM economy_ledger WHERE user_id='{alice}' AND kind='heart_regen';")
    assert regen == "3"


def test_concurrent_folder_purchases_charge_true_ordinal_prices(database, users):
    alice, _ = users
    database(entry_sql(alice, "folder-seed", "credit_reward", credits=225), role="service_role")
    statements = [folder_sql(alice, f"folder-{i}", f"Folder {i}") for i in range(8)]
    with ThreadPoolExecutor(max_workers=8) as executor:
        outcomes = list(executor.map(lambda s: attempt(database, s), statements))
    # 0+0+0+50+75+100 = 225 credits buys exactly six folders; the 7th (125) is unaffordable.
    created = [o for o in outcomes if isinstance(o, dict)]
    assert len(created) == 6
    assert sorted(-o["entry"]["credits_delta"] for o in created) == [0, 0, 0, 50, 75, 100]
    assert all("INSUFFICIENT_CREDITS" in o for o in outcomes if isinstance(o, str))
    w = wallet(database, alice)
    assert (w["credits"], w["folder_count"], w["next_folder_cost"]) == (0, 6, 125)
    first = created[0]
    key, name = first["entry"]["idempotency_key"], first["folder"]["name"]
    replay = json.loads(database(folder_sql(alice, key, name), role="service_role"))
    assert replay["replayed"] is True and replay["folder"]["id"] == first["folder"]["id"]
    database(folder_sql(alice, key, "Different name"), success=False, role="service_role")
    # Duplicate names roll back the whole purchase.
    database(folder_sql(alice, "dup-name", name), success=False, role="service_role")
    assert wallet(database, alice)["folder_count"] == 6


def test_account_deletion_removes_only_that_users_economy(database, users):
    alice, bob = users
    database(entry_sql(alice, "a-del", "credit_reward", credits=5), role="service_role")
    database(entry_sql(bob, "b-keep", "credit_reward", credits=7), role="service_role")
    database(f"DELETE FROM auth.users WHERE id='{alice}';")
    assert database(f"SELECT count(*) FROM economy_wallets WHERE user_id='{alice}';") == "0"
    assert database(f"SELECT count(*) FROM economy_ledger WHERE user_id='{alice}';") == "0"
    assert wallet(database, bob)["credits"] == 7
