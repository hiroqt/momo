from supabase import create_client, Client
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class SupabaseSession:
    def __init__(self):
        self.is_configured = (
            bool(settings.SUPABASE_URL)
            and "your-project" not in settings.SUPABASE_URL
            and "mock-project" not in settings.SUPABASE_URL
            and "your-supabase" not in settings.SUPABASE_SERVICE_ROLE_KEY
            and settings.SUPABASE_SERVICE_ROLE_KEY != "mock-service-role-key"
        )
        if self.is_configured:
            try:
                self.client: Client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_ROLE_KEY
                )
            except Exception as e:
                logger.warning(f"Failed to initialize live Supabase client: {e}. Falling back to in-memory store.")
                self.is_configured = False
                self.client = None
        else:
            self.client = None

supabase_session = SupabaseSession()
