-- Historical uploads predating upload tickets were confirmed to use the
-- Supabase `documents` bucket; keep their destinations explicit for deletion.
BEGIN;

UPDATE internal.upload_tickets
SET provider = 'supabase', bucket = 'documents'
WHERE legacy AND provider IS NULL AND bucket IS NULL;

CREATE INDEX upload_tickets_legacy_cleanup_idx
ON internal.upload_tickets(provider,bucket,next_check_at,id)
WHERE legacy AND status='retired';

COMMIT;
