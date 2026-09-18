from pydantic import BaseModel

class ErrorDetail(BaseModel):
    code: str
    message: str

class APIErrorResponse(BaseModel):
    error: ErrorDetail
