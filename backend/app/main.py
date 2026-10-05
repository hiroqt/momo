import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import (
    auth,
    chat,
    documents,
    folders,
    generations,
    images,
    math,
    stats,
    study_sets,
    sync,
)
from app.config import settings
from app.db.session import supabase_session


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = supabase_session.is_configured
    try:
        yield
    finally:
        supabase_session.close()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("study_platform")

app = FastAPI(
    title="AI Study Platform API",
    description="Grounded AI educational study reviewer generation API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT in {"development", "test"} else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT in {"development", "test"} else None,
)

# CORS configuration for Expo mobile client
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Error Handlers (Consistent RFC-style error format as required by AGENTS.md)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        err = exc.detail
    else:
        err = {
            "code": f"HTTP_{exc.status_code}",
            "message": str(exc.detail)
        }
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": err},
        headers=exc.headers
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters.",
                "details": [{"location": list(err["loc"]), "type": err["type"]} for err in exc.errors()]
            }
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server error (%s)", type(exc).__name__)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later."
            }
        }
    )

@app.exception_handler(APIError)
async def database_exception_handler(request: Request, exc: APIError):
    statuses = {"42501": (404, "RESOURCE_NOT_FOUND", "Resource not found."),
                "23505": (409, "RESOURCE_CONFLICT", "The requested record already exists."),
                "23503": (409, "INVALID_REFERENCE", "A related record is unavailable."),
                "23514": (422, "INVALID_RECORD", "The record contains invalid data.")}
    status_code, code, message = statuses.get(exc.code, (503, "DATABASE_UNAVAILABLE", "Data service is temporarily unavailable."))
    logger.warning("Database operation failed (%s)", exc.code)
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})

# Include API routes
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(generations.router)
app.include_router(study_sets.router)
app.include_router(sync.router)
app.include_router(math.router)
app.include_router(folders.router)
app.include_router(stats.router)
app.include_router(chat.router)
app.include_router(images.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AI Study Platform API"}

@app.get("/")
async def root():
    return {"message": "Welcome to AI Study Platform API"}
