-- RET-01: wait for issued upload URLs to expire before physically purging retired paths.
BEGIN;

CREATE OR REPLACE FUNCTION public.retire_ticket_on_auth_deletion() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE purge_after timestamptz;
BEGIN
    IF OLD.auth_ref IS NOT NULL AND NEW.auth_ref IS NULL THEN
        purge_after := GREATEST(now(), NEW.signed_until+interval '15 minutes');
        NEW.status := 'retired';
        NEW.next_check_at := purge_after;
        NEW.lease_token := NULL;
        NEW.lease_until := NULL;
        NEW.delete_required := false;
        IF NEW.uploaded_at IS NOT NULL THEN NEW.physical_expires_at := purge_after; END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.claim_upload_cleanup(p_limit integer DEFAULT 100,p_provider text DEFAULT NULL,p_bucket text DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
        OR (p_provider IS NOT NULL AND p_provider NOT IN ('supabase','s3')) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid cleanup claim';
    END IF;
    RETURN QUERY WITH candidates AS (
        SELECT id FROM internal.upload_tickets
        WHERE (NOT legacy OR status='retired')
            AND next_check_at<=now()
            AND (lease_until IS NULL OR lease_until<=now())
            AND (auth_ref IS NOT NULL AND status<>'retired' OR signed_until+interval '15 minutes'<=now())
            AND (p_provider IS NULL OR provider=p_provider) AND (p_bucket IS NULL OR bucket=p_bucket)
        ORDER BY next_check_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED
    )
    UPDATE internal.upload_tickets t SET lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',delete_required=false
    FROM candidates c WHERE t.id=c.id RETURNING to_jsonb(t);
END $$;

CREATE OR REPLACE FUNCTION public.prepare_upload_cleanup(p_id uuid,p_token uuid,p_metadata jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE ticket internal.upload_tickets; stamp timestamptz; cutoff timestamptz; purge_after timestamptz;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
    SELECT * INTO ticket FROM internal.upload_tickets WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR (ticket.legacy AND ticket.status<>'retired') OR p_token IS NULL
        OR ticket.lease_token IS DISTINCT FROM p_token OR ticket.lease_until IS NULL OR ticket.lease_until<=now() THEN RETURN false; END IF;
    purge_after := GREATEST(now(),ticket.signed_until+interval '15 minutes');
    IF (ticket.status='retired' OR ticket.auth_ref IS NULL) AND ticket.signed_until+interval '15 minutes'>now() THEN
        UPDATE internal.upload_tickets SET next_check_at=purge_after,lease_token=NULL,lease_until=NULL,
            delete_required=false WHERE id=p_id;
        RETURN false;
    END IF;
    IF p_metadata IS NULL THEN
        IF ticket.status='retired' OR ticket.auth_ref IS NULL THEN
            UPDATE internal.upload_tickets SET delete_required=true,physical_expires_at=purge_after,last_deleted_at=NULL WHERE id=p_id;
            UPDATE public.documents SET processing_status='EXPIRED',updated_at=now() WHERE id=p_id AND user_id=ticket.user_id;
            RETURN true;
        END IF;
        UPDATE internal.upload_tickets SET next_check_at=now()+interval '15 minutes',lease_token=NULL,lease_until=NULL,
            delete_required=false,last_deleted_at=now(),
            status=CASE WHEN status='retired' THEN status WHEN expires_at<=now() THEN 'expired' ELSE status END WHERE id=p_id;
        UPDATE public.documents SET processing_status='EXPIRED',updated_at=now()
            WHERE id=p_id AND user_id=ticket.user_id AND expires_at<=now();
        RETURN false;
    END IF;
    stamp := public.validate_upload_observation(ticket,p_metadata,false);
    IF ticket.auth_ref IS NULL OR ticket.status='retired' THEN cutoff := purge_after;
    ELSE cutoff := stamp+interval '72 hours'; END IF;
    UPDATE internal.upload_tickets SET physical_expires_at=cutoff,last_deleted_at=NULL WHERE id=p_id;
    IF ticket.uploaded_at IS NULL THEN
        UPDATE internal.upload_tickets SET uploaded_at=stamp,expires_at=stamp+interval '72 hours',
            identity=p_metadata->>'identity',version=p_metadata->>'version',etag=p_metadata->>'etag' WHERE id=p_id;
    ELSIF ticket.uploaded_at <> stamp OR ticket.identity IS DISTINCT FROM p_metadata->>'identity'
        OR ticket.version IS DISTINCT FROM p_metadata->>'version' OR ticket.etag IS DISTINCT FROM p_metadata->>'etag' THEN
        UPDATE internal.upload_tickets SET status=CASE WHEN status='retired' THEN 'retired' ELSE 'expired' END WHERE id=p_id;
        UPDATE public.documents SET processing_status='EXPIRED',updated_at=now() WHERE id=p_id AND user_id=ticket.user_id;
    END IF;
    IF cutoff>now() THEN
        UPDATE internal.upload_tickets SET next_check_at=cutoff,lease_token=NULL,lease_until=NULL,delete_required=false WHERE id=p_id;
        RETURN false;
    END IF;
    UPDATE internal.upload_tickets SET status=CASE WHEN status='retired' OR auth_ref IS NULL THEN 'retired' ELSE 'expired' END,
        delete_required=true WHERE id=p_id;
    UPDATE public.documents SET processing_status='EXPIRED',updated_at=now() WHERE id=p_id AND user_id=ticket.user_id;
    RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.retire_upload_ticket(p_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE ticket internal.upload_tickets; purge_after timestamptz;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
    SELECT * INTO ticket FROM internal.upload_tickets WHERE id=p_id AND user_id=p_user_id AND auth_ref=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    purge_after := GREATEST(now(),ticket.signed_until+interval '15 minutes');
    UPDATE internal.upload_tickets SET status='retired',next_check_at=purge_after,
        physical_expires_at=CASE WHEN uploaded_at IS NOT NULL THEN purge_after ELSE physical_expires_at END,
        lease_token=NULL,lease_until=NULL,delete_required=false WHERE id=p_id;
    UPDATE public.documents SET processing_status='EXPIRED',updated_at=now() WHERE id=p_id AND user_id=p_user_id;
    RETURN true;
END $$;

COMMIT;
