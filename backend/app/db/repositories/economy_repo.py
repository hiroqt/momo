"""Server-authoritative economy ledger (ECON-01 server part).

Database mode calls service-only RPCs from migration 005, which lock the owner's
wallet so concurrent spends serialize and cannot overdraft. Idempotency keys are
scoped to (user_id, key). Memory mode exists only for development/test runs and
mirrors the same rules under one process-local lock.
"""
import asyncio
import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.db.session import supabase_session
from app.domain.economy import MAX_HEARTS, EconomyPolicy, folder_credit_cost

_BUSINESS_ERRORS: dict[str, str] = {
    "INSUFFICIENT_HEARTS": "You have no hearts left. Wait for hearts to refill.",
    "HEARTS_FULL": "Your hearts are already full.",
    "INSUFFICIENT_CREDITS": "You do not have enough credits for this.",
    "INSUFFICIENT_XP": "You do not have enough XP for this.",
    "IDEMPOTENCY_KEY_REUSED": "This request key was already used for a different action.",
}
_ENTRY_KINDS = {"heart_loss", "heart_refill", "xp_reward", "credit_reward",
                "xp_conversion", "cosmetic_purchase", "adjustment"}


def economy_error(code: str) -> HTTPException:
    return HTTPException(409, detail={"code": code, "message": _BUSINESS_ERRORS[code]})


def _invalid() -> HTTPException:
    return HTTPException(422, detail={"code": "INVALID_ECONOMY_REQUEST", "message": "The economy request is invalid."})


def _translate(exc: APIError, not_found_code: str = "RESOURCE_NOT_FOUND") -> HTTPException | None:
    message = getattr(exc, "message", "") or ""
    if message in _BUSINESS_ERRORS:
        return economy_error(message)
    if exc.code == "22023":
        return _invalid()
    if exc.code == "42501":
        return HTTPException(404, detail={"code": not_found_code, "message": "Resource not found."})
    return None


def _entry_is_valid(kind: str, h: int, c: int, x: int) -> bool:
    if kind not in _ENTRY_KINDS or abs(h) > MAX_HEARTS or abs(c) > 1_000_000 or abs(x) > 1_000_000:
        return False
    rules = {
        "heart_loss": h == -1 and c == 0 and x == 0,
        "heart_refill": h > 0 and c <= 0 and x <= 0 and (c != 0 or x != 0),
        "xp_reward": x > 0 and h == 0 and c == 0,
        "credit_reward": c > 0 and h == 0 and x == 0,
        "xp_conversion": x < 0 and h >= 0 and c >= 0 and (h != 0 or c != 0),
        "cosmetic_purchase": c < 0 and h == 0 and x == 0,
        "adjustment": True,
    }
    return rules[kind]


def _fingerprint(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


class EconomyRepository:
    def __init__(self) -> None:
        self._wallets: dict[str, dict[str, Any]] = {}
        self._ledger: dict[tuple[str, str], dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    # ----- memory helpers (development/test only) -----
    def _memory_wallet(self, user_id: str, policy: EconomyPolicy) -> dict[str, Any]:
        now = datetime.now(UTC)
        wallet = self._wallets.setdefault(user_id, {
            "hearts": MAX_HEARTS, "credits": 0, "xp": 0, "hearts_refreshed_at": now, "version": 0})
        interval = policy.heart_regen_seconds
        if interval and wallet["hearts"] < MAX_HEARTS:
            gained = int((now - wallet["hearts_refreshed_at"]).total_seconds() // interval)
            if gained > 0:
                old = wallet["hearts"]
                wallet["hearts"] = min(MAX_HEARTS, old + gained)
                wallet["hearts_refreshed_at"] = now if wallet["hearts"] == MAX_HEARTS else (
                    wallet["hearts_refreshed_at"] + timedelta(seconds=gained * interval))
                wallet["version"] += 1
                self._record(user_id, f"regen:{uuid.uuid4()}", "heart_regen", wallet["hearts"] - old, 0, 0,
                             wallet, None, None, "system")
        return wallet

    def _wallet_view(self, user_id: str, wallet: dict[str, Any]) -> dict[str, Any]:
        from app.db.repositories.folder_repo import folder_repo
        count = sum(1 for row in folder_repo._folders.values() if row.get("user_id") == user_id)
        return {"hearts": wallet["hearts"], "max_hearts": MAX_HEARTS, "credits": wallet["credits"],
                "xp": wallet["xp"], "hearts_refreshed_at": wallet["hearts_refreshed_at"].isoformat(),
                "version": wallet["version"], "folder_count": count,
                "next_folder_cost": folder_credit_cost(count)}

    def _record(self, user_id: str, key: str, kind: str, h: int, c: int, x: int, wallet: dict[str, Any],
                study_item_id: str | None, folder_id: str | None, fingerprint: str) -> dict[str, Any]:
        entry = {"id": str(uuid.uuid4()), "user_id": user_id, "idempotency_key": key, "kind": kind,
                 "hearts_delta": h, "credits_delta": c, "xp_delta": x, "hearts_after": wallet["hearts"],
                 "credits_after": wallet["credits"], "xp_after": wallet["xp"], "study_item_id": study_item_id,
                 "folder_id": folder_id, "request_fingerprint": fingerprint,
                 "created_at": datetime.now(UTC).isoformat()}
        self._ledger[(user_id, key)] = entry
        return entry

    # ----- public API -----
    async def get_wallet(self, user_id: str, policy: EconomyPolicy) -> dict[str, Any]:
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = await supabase_session.execute(supabase_session.client.rpc("get_economy_wallet", {
                    "p_user_id": user_id, "p_heart_regen_seconds": policy.heart_regen_seconds}))
            except APIError as exc:
                raise _translate(exc) or exc from None
            return resp.data
        async with self._lock:
            return self._wallet_view(user_id, self._memory_wallet(user_id, policy))

    async def apply_entry(self, user_id: str, idempotency_key: str, kind: str, *, policy: EconomyPolicy,
                          hearts_delta: int = 0, credits_delta: int = 0, xp_delta: int = 0,
                          study_item_id: str | None = None, folder_id: str | None = None) -> dict[str, Any]:
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = await supabase_session.execute(supabase_session.client.rpc("apply_economy_entry", {
                    "p_user_id": user_id, "p_idempotency_key": idempotency_key, "p_kind": kind,
                    "p_hearts_delta": hearts_delta, "p_credits_delta": credits_delta, "p_xp_delta": xp_delta,
                    "p_study_item_id": study_item_id, "p_folder_id": folder_id,
                    "p_heart_regen_seconds": policy.heart_regen_seconds}))
            except APIError as exc:
                raise _translate(exc, "STUDY_ITEM_NOT_FOUND") or exc from None
            return resp.data
        h, c, x = hearts_delta, credits_delta, xp_delta
        if not idempotency_key.strip() or len(idempotency_key) > 160 or not _entry_is_valid(kind, h, c, x):
            raise _invalid()
        fingerprint = _fingerprint({"kind": kind, "hearts": h, "credits": c, "xp": x,
                                    "study_item_id": study_item_id, "folder_id": folder_id})
        async with self._lock:
            wallet = self._memory_wallet(user_id, policy)
            existing = self._ledger.get((user_id, idempotency_key))
            if existing:
                if existing["request_fingerprint"] != fingerprint:
                    raise economy_error("IDEMPOTENCY_KEY_REUSED")
                return {"replayed": True, "entry": existing, "wallet": self._wallet_view(user_id, wallet)}
            if study_item_id and not self._owns_item(user_id, study_item_id):
                raise HTTPException(404, detail={"code": "STUDY_ITEM_NOT_FOUND", "message": "Resource not found."})
            if wallet["hearts"] + h < 0:
                raise economy_error("INSUFFICIENT_HEARTS")
            if wallet["hearts"] + h > MAX_HEARTS:
                raise economy_error("HEARTS_FULL")
            if wallet["credits"] + c < 0:
                raise economy_error("INSUFFICIENT_CREDITS")
            if wallet["xp"] + x < 0:
                raise economy_error("INSUFFICIENT_XP")
            if wallet["hearts"] == MAX_HEARTS and h < 0:
                wallet["hearts_refreshed_at"] = datetime.now(UTC)
            wallet["hearts"] += h
            wallet["credits"] += c
            wallet["xp"] += x
            wallet["version"] += 1
            entry = self._record(user_id, idempotency_key, kind, h, c, x, wallet, study_item_id, folder_id, fingerprint)
            return {"replayed": False, "entry": entry, "wallet": self._wallet_view(user_id, wallet)}

    async def create_folder_with_charge(self, user_id: str, idempotency_key: str, name: str,
                                        color: str | None, *, policy: EconomyPolicy) -> dict[str, Any]:
        """Atomically create a folder and charge its PRD price (pending route wiring)."""
        if supabase_session.is_configured and supabase_session.client:
            try:
                resp = await supabase_session.execute(supabase_session.client.rpc("create_folder_with_charge", {
                    "p_user_id": user_id, "p_idempotency_key": idempotency_key, "p_name": name,
                    "p_color": color, "p_heart_regen_seconds": policy.heart_regen_seconds}))
            except APIError as exc:
                if exc.code == "23505":
                    raise HTTPException(409, detail={"code": "FOLDER_NAME_EXISTS",
                                                     "message": "A folder with this name already exists."}) from None
                raise _translate(exc) or exc from None
            return resp.data
        from app.db.repositories.folder_repo import folder_repo
        clean = name.strip()
        if not idempotency_key.strip() or len(idempotency_key) > 160 or not 1 <= len(clean) <= 100:
            raise _invalid()
        fingerprint = _fingerprint({"kind": "folder_purchase", "name": clean.lower(), "color": color})
        async with self._lock:
            wallet = self._memory_wallet(user_id, policy)
            existing = self._ledger.get((user_id, idempotency_key))
            if existing:
                if existing["request_fingerprint"] != fingerprint:
                    raise economy_error("IDEMPOTENCY_KEY_REUSED")
                folder = folder_repo._folders.get(existing["folder_id"] or "")
                return {"replayed": True, "entry": existing, "folder": folder,
                        "wallet": self._wallet_view(user_id, wallet)}
            count = sum(1 for row in folder_repo._folders.values() if row.get("user_id") == user_id)
            cost = folder_credit_cost(count)
            if wallet["credits"] < cost:
                raise economy_error("INSUFFICIENT_CREDITS")
            folder = await folder_repo.create_folder({"user_id": user_id, "name": clean, "color": color or "#4F46E5"})
            wallet["credits"] -= cost
            wallet["version"] += 1
            entry = self._record(user_id, idempotency_key, "folder_purchase", 0, -cost, 0, wallet, None,
                                 folder["id"], fingerprint)
            return {"replayed": False, "entry": entry, "folder": folder, "wallet": self._wallet_view(user_id, wallet)}

    @staticmethod
    def _owns_item(user_id: str, item_id: str) -> bool:
        from app.db.repositories.study_repo import study_repo
        return any(item.get("id") == item_id and study_repo._study_sets.get(set_id, {}).get("user_id") == user_id
                   for set_id, items in study_repo._study_items.items() for item in items)


economy_repo = EconomyRepository()
