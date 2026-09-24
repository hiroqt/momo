import logging
from app.config import settings
from app.services.storage.base import BaseStorageService
from app.services.storage.s3_service import S3Service, s3_service
from app.services.storage.supabase_storage_service import SupabaseStorageService

logger = logging.getLogger(__name__)

def get_storage_service() -> BaseStorageService:
    provider = getattr(settings, "STORAGE_PROVIDER", "supabase").lower()
    if provider == "supabase":
        logger.info("Initializing Supabase Storage provider.")
        return SupabaseStorageService()
    elif provider == "s3":
        logger.info("Initializing AWS S3 Storage provider.")
        return s3_service
    else:
        logger.info(f"Using default Supabase Storage provider for provider '{provider}'.")
        return SupabaseStorageService()

storage_service: BaseStorageService = get_storage_service()

__all__ = [
    "BaseStorageService",
    "SupabaseStorageService",
    "S3Service",
    "storage_service",
    "s3_service",
    "get_storage_service"
]
