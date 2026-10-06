"""Typed job outcomes shared by handlers and the durable job runner."""


class TransientJobError(RuntimeError):
    """Retryable failure; the queue reschedules the job until attempts run out."""

    code = "TRANSIENT_FAILURE"


class PermanentJobError(RuntimeError):
    """Non-retryable failure; the job is dead-lettered immediately."""

    code = "PERMANENT_FAILURE"
