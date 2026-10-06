"""Server-authoritative hearts/XP/credits (PRD 6.6/6.7, ECON-01).

Clients send intent plus an idempotency key; the server computes every amount.
Operations whose price/amount the PRD does not define fail closed with
ECONOMY_POLICY_PENDING instead of inventing values.
"""
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.db.repositories.economy_repo import economy_repo
from app.dependencies import AuthenticatedUser, get_current_user
from app.domain.economy import (
    HEARTS_LOST_PER_INCORRECT_ANSWER,
    MAX_HEARTS,
    PENDING_POLICY,
    EconomyPolicy,
)
from app.schemas.economy import (
    EconomyTransactionResponse,
    HeartConsumeRequest,
    HeartRefillRequest,
    WalletResponse,
)

router = APIRouter(prefix="/api/economy", tags=["Economy"])


def get_economy_policy() -> EconomyPolicy:
    """Approved economy tunables. Overridable via dependency injection in tests."""
    return PENDING_POLICY


def _wallet(raw: dict[str, Any], policy: EconomyPolicy) -> WalletResponse:
    next_heart_at = None
    if policy.heart_regen_seconds and raw["hearts"] < MAX_HEARTS:
        refreshed = datetime.fromisoformat(str(raw["hearts_refreshed_at"]))
        next_heart_at = refreshed + timedelta(seconds=policy.heart_regen_seconds)
    return WalletResponse(
        hearts=raw["hearts"], max_hearts=MAX_HEARTS, credits=raw["credits"], xp=raw["xp"],
        version=raw["version"], folder_count=raw["folder_count"], next_folder_cost=raw["next_folder_cost"],
        next_heart_at=next_heart_at,
        policy={"heart_regen_seconds": policy.heart_regen_seconds,
                "heart_refill_credit_price": policy.heart_refill_credit_price},
    )


def _transaction(raw: dict[str, Any], policy: EconomyPolicy) -> EconomyTransactionResponse:
    return EconomyTransactionResponse(replayed=raw["replayed"], entry=raw["entry"], wallet=_wallet(raw["wallet"], policy))


@router.get("/wallet", response_model=WalletResponse)
async def get_wallet(user: AuthenticatedUser = Depends(get_current_user),
                     policy: EconomyPolicy = Depends(get_economy_policy)):
    return _wallet(await economy_repo.get_wallet(user.id, policy), policy)


@router.post("/hearts/consume", response_model=EconomyTransactionResponse)
async def consume_heart(req: HeartConsumeRequest, user: AuthenticatedUser = Depends(get_current_user),
                        policy: EconomyPolicy = Depends(get_economy_policy)):
    """Record an incorrect quiz answer (PRD: consumes 1 heart). Retry-safe by key."""
    raw = await economy_repo.apply_entry(
        user.id, req.idempotency_key, "heart_loss", policy=policy,
        hearts_delta=-HEARTS_LOST_PER_INCORRECT_ANSWER,
        study_item_id=str(req.study_item_id) if req.study_item_id else None)
    return _transaction(raw, policy)


@router.post("/hearts/refill", response_model=EconomyTransactionResponse)
async def refill_hearts(req: HeartRefillRequest, user: AuthenticatedUser = Depends(get_current_user),
                        policy: EconomyPolicy = Depends(get_economy_policy)):
    """Refill hearts with earned credits at the approved server price."""
    if policy.heart_refill_credit_price is None:
        raise HTTPException(503, detail={"code": "ECONOMY_POLICY_PENDING",
                                         "message": "Heart refills are not available yet."})
    raw = await economy_repo.apply_entry(
        user.id, req.idempotency_key, "heart_refill", policy=policy, hearts_delta=req.hearts,
        credits_delta=-req.hearts * policy.heart_refill_credit_price)
    return _transaction(raw, policy)
