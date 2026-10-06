from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Client-generated retry key (e.g. a UUID). Scoped server-side to the verified user.
IdempotencyKey = Field(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")


class EconomyPolicyResponse(BaseModel):
    heart_regen_seconds: int | None = None
    heart_refill_credit_price: int | None = None


class WalletResponse(BaseModel):
    hearts: int
    max_hearts: int
    credits: int
    xp: int
    version: int
    folder_count: int
    next_folder_cost: int
    next_heart_at: datetime | None = None
    policy: EconomyPolicyResponse


class LedgerEntryResponse(BaseModel):
    id: str
    kind: str
    idempotency_key: str
    hearts_delta: int
    credits_delta: int
    xp_delta: int
    hearts_after: int
    credits_after: int
    xp_after: int
    study_item_id: str | None = None
    folder_id: str | None = None
    created_at: datetime


class EconomyTransactionResponse(BaseModel):
    replayed: bool
    entry: LedgerEntryResponse
    wallet: WalletResponse


class HeartConsumeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = IdempotencyKey
    study_item_id: UUID | None = None


class HeartRefillRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = IdempotencyKey
    hearts: int = Field(ge=1, le=5)
