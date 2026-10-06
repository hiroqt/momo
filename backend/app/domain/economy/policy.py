"""Server-side economy rules (PRD 6.6/6.7).

Only values written in the PRD are fixed here. Values the PRD leaves open
(regeneration interval, coin refill price, XP/coin reward amounts, conversion
rates) default to ``None`` and the corresponding operations fail closed until an
approved policy supplies them. Never copy prototype client constants here.
"""
from dataclasses import dataclass

MAX_HEARTS = 5
"""PRD 6.7: students maintain 5 hearts."""

HEARTS_LOST_PER_INCORRECT_ANSWER = 1
"""PRD 6.7: an incorrect quiz answer consumes 1 heart."""


def folder_credit_cost(existing_count: int) -> int:
    """PRD 6.6 price of the next folder given how many the user already owns.

    Folders 1-3 are free; the Nth folder (N >= 4) costs 50 + (N - 4) * 25.
    """
    if isinstance(existing_count, bool) or not isinstance(existing_count, int) or existing_count < 0:
        raise ValueError("Folder count must be a non-negative integer")
    ordinal = existing_count + 1
    return 0 if ordinal <= 3 else 50 + (ordinal - 4) * 25


@dataclass(frozen=True)
class EconomyPolicy:
    """Approved tunables. ``None`` means the product decision is pending."""

    heart_regen_seconds: int | None = None
    heart_refill_credit_price: int | None = None

    def __post_init__(self) -> None:
        if self.heart_regen_seconds is not None and not 60 <= self.heart_regen_seconds <= 604800:
            raise ValueError("Heart regeneration interval out of bounds")
        if self.heart_refill_credit_price is not None and not 1 <= self.heart_refill_credit_price <= 100000:
            raise ValueError("Heart refill price out of bounds")


PENDING_POLICY = EconomyPolicy()
