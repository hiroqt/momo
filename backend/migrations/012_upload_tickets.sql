-- RET-01: durable issued-upload responsibility and registration/cleanup fencing.
-- Apply after 001-011. Legacy rows preserve their existing retention policy and
-- are excluded from ticket cleanup until their provider/timestamps are verified.
BEGIN;
CREATE TABLE internal.upload_tickets (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    auth_ref uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    object_key text NOT NULL UNIQUE,
    file_type text NOT NULL CHECK(file_type IN ('pdf','docx','txt','pptx')),
    mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 1 AND 255),
    file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 15728640),
    provider text CHECK(provider IN ('supabase','s3')),
    bucket text,
    issued_at timestamptz NOT NULL DEFAULT now(),
    signed_until timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','registered','expired','retired')),
    legacy boolean NOT NULL DEFAULT false,
    uploaded_at timestamptz,
    expires_at timestamptz,
    physical_expires_at timestamptz,
    identity text,
    version text,
    etag text,
    next_check_at timestamptz NOT NULL DEFAULT now(),
    lease_token uuid,
    lease_until timestamptz,
    delete_required boolean NOT NULL DEFAULT false,
    last_deleted_at timestamptz,
    CONSTRAINT upload_ticket_owner_path CHECK(object_key='documents/'||user_id::text||'/'||id::text||'/original.'||file_type),
    CONSTRAINT upload_ticket_driver CHECK(legacy OR (provider IS NOT NULL AND bucket IS NOT NULL)),
    CONSTRAINT upload_ticket_expiry CHECK((uploaded_at IS NULL AND expires_at IS NULL) OR
        (uploaded_at IS NOT NULL AND expires_at IS NOT NULL AND
            ((NOT legacy AND expires_at=uploaded_at+interval '72 hours') OR (legacy AND expires_at<=uploaded_at+interval '72 hours')))),
    CONSTRAINT upload_ticket_lease CHECK((lease_token IS NULL)=(lease_until IS NULL))
);
CREATE INDEX upload_tickets_cleanup_idx ON internal.upload_tickets(provider,bucket,next_check_at,id) WHERE NOT legacy;
CREATE INDEX upload_tickets_owner_idx ON internal.upload_tickets(user_id,id);
ALTER TABLE internal.upload_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.upload_tickets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON internal.upload_tickets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON internal.upload_tickets TO service_role;

-- Do not fabricate a provider/bucket or reinterpret historical registration time.
INSERT INTO internal.upload_tickets(id,user_id,auth_ref,object_key,file_type,mime_type,file_size,
    issued_at,signed_until,status,legacy,uploaded_at,expires_at,physical_expires_at,next_check_at)
SELECT id,user_id,user_id,s3_object_key,file_type,mime_type,file_size,uploaded_at,uploaded_at,
    CASE WHEN processing_status='EXPIRED' THEN 'expired' ELSE 'registered' END,true,
    uploaded_at,expires_at,expires_at,expires_at FROM public.documents;

CREATE FUNCTION public.retire_ticket_on_auth_deletion() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
    IF OLD.auth_ref IS NOT NULL AND NEW.auth_ref IS NULL THEN
        NEW.status := 'retired'; NEW.next_check_at := now();
        IF NEW.uploaded_at IS NOT NULL THEN NEW.physical_expires_at := now(); END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER upload_ticket_auth_cleanup BEFORE UPDATE OF auth_ref ON internal.upload_tickets
    FOR EACH ROW EXECUTE FUNCTION public.retire_ticket_on_auth_deletion();

CREATE FUNCTION public.issue_upload_ticket(p_ticket jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE ticket internal.upload_tickets; owner_id uuid; ticket_id uuid; deadline timestamptz;
BEGIN
    IF coalesce(p_ticket->>'signed_until','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
    END IF;
    BEGIN
        owner_id := (p_ticket->>'user_id')::uuid; ticket_id := (p_ticket->>'id')::uuid;
        deadline := (p_ticket->>'signed_until')::timestamptz;
    EXCEPTION WHEN data_exception THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA'; END;
    IF jsonb_typeof(p_ticket) IS DISTINCT FROM 'object' OR owner_id IS NULL OR ticket_id IS NULL
        OR deadline IS NULL OR deadline <= now() OR deadline > now()+interval '72 hours'
        OR p_ticket->>'provider' NOT IN ('supabase','s3') OR p_ticket->>'provider' IS NULL
        OR coalesce(p_ticket->>'bucket','') !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$'
        OR coalesce(p_ticket->>'mime_type','') ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(ticket_id::text,0));
    SELECT * INTO ticket FROM internal.upload_tickets WHERE id=ticket_id FOR UPDATE;
    IF FOUND THEN
        -- Reissuing a path would permit a deleted source to be resurrected.
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_UNAVAILABLE';
    END IF;
    INSERT INTO internal.upload_tickets(id,user_id,auth_ref,object_key,file_type,mime_type,file_size,provider,bucket,signed_until)
    VALUES(ticket_id,owner_id,owner_id,p_ticket->>'object_key',p_ticket->>'file_type',p_ticket->>'mime_type',
        (p_ticket->>'file_size')::bigint,p_ticket->>'provider',p_ticket->>'bucket',deadline) RETURNING * INTO ticket;
    RETURN to_jsonb(ticket);
EXCEPTION WHEN foreign_key_violation THEN
    -- The FK validates the auth identity without granting service code access
    -- to the contents of auth.users.
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
END $$;

CREATE FUNCTION public.get_upload_ticket(p_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
    SELECT to_jsonb(t) FROM internal.upload_tickets t WHERE id=p_id AND user_id=p_user_id AND auth_ref=p_user_id;
$$;

CREATE FUNCTION public.validate_upload_observation(p_ticket internal.upload_tickets,p_metadata jsonb,p_match_size boolean DEFAULT false)
RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE stamp timestamptz; size bigint; field text;
BEGIN
    IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_metadata->'size') IS DISTINCT FROM 'number'
        OR coalesce(p_metadata->>'size','') !~ '^[0-9]{1,13}$'
        OR coalesce(p_metadata->>'uploaded_at','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
    END IF;
    BEGIN stamp := (p_metadata->>'uploaded_at')::timestamptz; size := (p_metadata->>'size')::bigint;
    EXCEPTION WHEN data_exception THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA'; END;
    IF size NOT BETWEEN 0 AND 5497558138880 OR (p_match_size AND (size NOT BETWEEN 1 AND 15728640 OR size <> p_ticket.file_size))
        OR (NOT (p_ticket.legacy AND p_ticket.status='retired') AND stamp < p_ticket.issued_at-interval '5 minutes')
        OR stamp > now()+interval '5 minutes' THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
    END IF;
    FOREACH field IN ARRAY ARRAY['identity','version','etag'] LOOP
        IF p_metadata->field IS NOT NULL AND p_metadata->field <> 'null'::jsonb
            AND (jsonb_typeof(p_metadata->field) IS DISTINCT FROM 'string'
                OR length(p_metadata->>field) NOT BETWEEN 1 AND 1024 OR p_metadata->>field ~ '[[:cntrl:]]') THEN
            RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
        END IF;
    END LOOP;
    RETURN stamp;
END $$;

CREATE OR REPLACE FUNCTION public.register_document(p_document jsonb,p_monthly_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_id uuid := (p_document->>'user_id')::uuid; document_id uuid := (p_document->>'id')::uuid;
    ticket internal.upload_tickets; stored public.documents; stamp timestamptz; consumed integer;
    month_key text := to_char(now() AT TIME ZONE 'UTC','YYYY-MM'); observation jsonb;
BEGIN
    IF owner_id IS NULL OR document_id IS NULL OR p_monthly_limit IS NULL OR p_monthly_limit NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid registration parameters';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(document_id::text,0));
    SELECT * INTO ticket FROM internal.upload_tickets WHERE id=document_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_TICKET_REQUIRED'; END IF;
    IF ticket.user_id <> owner_id OR ticket.auth_ref IS DISTINCT FROM owner_id OR ticket.status NOT IN ('issued','registered') THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_UNAVAILABLE';
    END IF;
    IF ticket.lease_until > now() THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_BUSY'; END IF;
    SELECT * INTO stored FROM public.documents WHERE id=document_id;
    IF FOUND THEN
        IF stored.user_id <> owner_id OR stored.processing_status='EXPIRED' OR stored.expires_at<=now() THEN
            RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_UNAVAILABLE';
        END IF;
        RETURN to_jsonb(stored);
    END IF;
    IF ticket.legacy OR ticket.status <> 'issued' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_UNAVAILABLE'; END IF;
    IF p_document->>'s3_object_key' IS DISTINCT FROM ticket.object_key
        OR p_document->>'file_type' IS DISTINCT FROM ticket.file_type
        OR p_document->>'mime_type' IS DISTINCT FROM ticket.mime_type
        OR (p_document->>'file_size')::bigint IS DISTINCT FROM ticket.file_size THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
    END IF;
    observation := jsonb_build_object('size',p_document->'file_size','uploaded_at',p_document->'uploaded_at',
        'identity',p_document->'object_identity','version',p_document->'object_version','etag',p_document->'object_etag');
    stamp := public.validate_upload_observation(ticket,observation,true);
    IF stamp+interval '72 hours' <= now() THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='UPLOAD_UNAVAILABLE'; END IF;
    IF ticket.uploaded_at IS NOT NULL AND (ticket.uploaded_at <> stamp
        OR ticket.identity IS DISTINCT FROM p_document->>'object_identity' OR ticket.version IS DISTINCT FROM p_document->>'object_version'
        OR ticket.etag IS DISTINCT FROM p_document->>'object_etag') THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_UPLOAD_METADATA';
    END IF;
    INSERT INTO public.usage_records(user_id,year_month,documents_count) VALUES(owner_id,month_key,1)
    ON CONFLICT(user_id,year_month) DO UPDATE SET documents_count=public.usage_records.documents_count+1,updated_at=now()
    WHERE public.usage_records.documents_count < p_monthly_limit RETURNING documents_count INTO consumed;
    IF consumed IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='MONTHLY_DOCUMENT_LIMIT'; END IF;
    INSERT INTO public.documents(id,user_id,original_filename,file_type,mime_type,file_size,s3_object_key,uploaded_at,expires_at,processing_status)
    VALUES(document_id,owner_id,p_document->>'original_filename',ticket.file_type,ticket.mime_type,ticket.file_size,
        ticket.object_key,stamp,stamp+interval '72 hours','UPLOADED') RETURNING * INTO stored;
    UPDATE internal.upload_tickets SET status='registered',uploaded_at=stamp,expires_at=stamp+interval '72 hours',
        physical_expires_at=stamp+interval '72 hours',
        identity=p_document->>'object_identity',version=p_document->>'object_version',etag=p_document->>'object_etag',next_check_at=stamp+interval '72 hours',
        lease_token=NULL,lease_until=NULL WHERE id=document_id;
    RETURN to_jsonb(stored);
END $$;

CREATE FUNCTION public.claim_upload_cleanup(p_limit integer DEFAULT 100,p_provider text DEFAULT NULL,p_bucket text DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
        OR (p_provider IS NOT NULL AND p_provider NOT IN ('supabase','s3')) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid cleanup claim';
    END IF;
    RETURN QUERY WITH candidates AS (SELECT id FROM internal.upload_tickets WHERE (NOT legacy OR status='retired')
        AND next_check_at<=now() AND (lease_until IS NULL OR lease_until<=now())
        AND (p_provider IS NULL OR provider=p_provider) AND (p_bucket IS NULL OR bucket=p_bucket)
        ORDER BY next_check_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    UPDATE internal.upload_tickets t SET lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',delete_required=false
    FROM candidates c WHERE t.id=c.id RETURNING to_jsonb(t);
END $$;

CREATE FUNCTION public.prepare_upload_cleanup(p_id uuid,p_token uuid,p_metadata jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE ticket internal.upload_tickets; stamp timestamptz; cutoff timestamptz;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
    SELECT * INTO ticket FROM internal.upload_tickets WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR (ticket.legacy AND ticket.status<>'retired') OR p_token IS NULL
        OR ticket.lease_token IS DISTINCT FROM p_token OR ticket.lease_until IS NULL OR ticket.lease_until<=now() THEN RETURN false; END IF;
    IF p_metadata IS NULL THEN
        IF ticket.status='retired' OR ticket.auth_ref IS NULL THEN
            -- Explicit retirement authorizes cleanup of every object generation,
            -- including hidden versions behind an absent current HEAD. The worker
            -- must finish the provider's bounded version inventory before ack.
            UPDATE internal.upload_tickets SET delete_required=true,physical_expires_at=now(),last_deleted_at=NULL WHERE id=p_id;
            UPDATE public.documents SET processing_status='EXPIRED',updated_at=now() WHERE id=p_id AND user_id=ticket.user_id;
            RETURN true;
        END IF;
        -- Missing bytes do not prove that an upload which began before signed
        -- URL expiry cannot finish later. Keep an inspectable tombstone.
        UPDATE internal.upload_tickets SET next_check_at=now()+interval '15 minutes',lease_token=NULL,lease_until=NULL,
            delete_required=false,last_deleted_at=now(),
            status=CASE WHEN status='retired' THEN status WHEN expires_at<=now() THEN 'expired' ELSE status END WHERE id=p_id;
        UPDATE public.documents SET processing_status='EXPIRED',updated_at=now()
            WHERE id=p_id AND user_id=ticket.user_id AND expires_at<=now();
        RETURN false;
    END IF;
    stamp := public.validate_upload_observation(ticket,p_metadata,false);
    IF ticket.auth_ref IS NULL OR ticket.status='retired' THEN cutoff := now();
    ELSE cutoff := stamp+interval '72 hours'; END IF;
    UPDATE internal.upload_tickets SET physical_expires_at=cutoff,last_deleted_at=NULL WHERE id=p_id;
    IF ticket.uploaded_at IS NULL THEN
        UPDATE internal.upload_tickets SET uploaded_at=stamp,expires_at=stamp+interval '72 hours',
            identity=p_metadata->>'identity',version=p_metadata->>'version',etag=p_metadata->>'etag' WHERE id=p_id;
    ELSIF ticket.uploaded_at <> stamp OR ticket.identity IS DISTINCT FROM p_metadata->>'identity'
        OR ticket.version IS DISTINCT FROM p_metadata->>'version' OR ticket.etag IS DISTINCT FROM p_metadata->>'etag' THEN
        -- Recreated bytes never extend the accepted source. They receive their
        -- own physical age cutoff unless the user explicitly retired the source.
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

CREATE FUNCTION public.finish_upload_cleanup(p_id uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
    UPDATE internal.upload_tickets SET lease_token=NULL,lease_until=NULL,delete_required=false,
        last_deleted_at=now(),next_check_at=now()+interval '15 minutes'
    WHERE id=p_id AND lease_token=p_token AND lease_until>now() AND delete_required;
    RETURN FOUND;
END $$;

CREATE FUNCTION public.retire_upload_ticket(p_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE ticket internal.upload_tickets;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
    SELECT * INTO ticket FROM internal.upload_tickets WHERE id=p_id AND user_id=p_user_id AND auth_ref=p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    UPDATE internal.upload_tickets SET status='retired',next_check_at=now(),
        physical_expires_at=CASE WHEN uploaded_at IS NOT NULL THEN now() ELSE physical_expires_at END WHERE id=p_id;
    UPDATE public.documents SET processing_status='EXPIRED',updated_at=now() WHERE id=p_id AND user_id=p_user_id;
    RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.retention_backlog() RETURNS jsonb
LANGUAGE sql SET search_path=pg_catalog,public AS $$
    SELECT jsonb_build_object('overdue_count',count(*) FILTER(WHERE physical_expires_at<=now() AND last_deleted_at IS NULL),
        'oldest_overdue_seconds',coalesce(floor(extract(epoch FROM now()-min(physical_expires_at)
            FILTER(WHERE physical_expires_at<=now() AND last_deleted_at IS NULL)))::bigint,0),
        'unresolved_legacy_count',count(*) FILTER(WHERE legacy AND (provider IS NULL OR bucket IS NULL)
            AND physical_expires_at<=now() AND last_deleted_at IS NULL),
        'pending_probe_count',count(*) FILTER(WHERE uploaded_at IS NULL AND next_check_at<=now()))
    FROM internal.upload_tickets;
$$;

REVOKE ALL ON FUNCTION public.retire_ticket_on_auth_deletion(),public.issue_upload_ticket(jsonb),public.get_upload_ticket(uuid,uuid),
    public.validate_upload_observation(internal.upload_tickets,jsonb,boolean),public.claim_upload_cleanup(integer,text,text),
    public.prepare_upload_cleanup(uuid,uuid,jsonb),public.finish_upload_cleanup(uuid,uuid),public.retire_upload_ticket(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_upload_ticket(jsonb),public.get_upload_ticket(uuid,uuid),
    public.validate_upload_observation(internal.upload_tickets,jsonb,boolean),public.claim_upload_cleanup(integer,text,text),
    public.prepare_upload_cleanup(uuid,uuid,jsonb),public.finish_upload_cleanup(uuid,uuid),public.retire_upload_ticket(uuid,uuid) TO service_role;
COMMIT;
