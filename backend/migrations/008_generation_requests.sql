-- WORK-02: owner-scoped retry-safe generation creation. Apply after 001-007.
-- Existing callers without request keys retain their existing behavior.
-- Rollback: remove these two RPCs and the internal table after disabling keyed
-- clients. Existing generation jobs/study sets are retained.
BEGIN;

ALTER TABLE public.generation_jobs ADD CONSTRAINT generation_jobs_id_owner_unique UNIQUE (id,user_id);
-- Set only by the server's authorized FAILED -> PENDING retry transition.
ALTER TABLE public.generation_jobs ADD COLUMN retry_dispatch_pending boolean NOT NULL DEFAULT false;

CREATE TABLE internal.generation_requests (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_.:-]{8,128}$'),
    fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    job_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, request_key),
    FOREIGN KEY (job_id, user_id) REFERENCES public.generation_jobs(id, user_id) ON DELETE CASCADE
);
CREATE INDEX generation_requests_job_idx ON internal.generation_requests(job_id);
ALTER TABLE internal.generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.generation_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON internal.generation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON internal.generation_requests TO service_role;

CREATE FUNCTION public.get_generation_request(p_user_id uuid, p_key text, p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE request internal.generation_requests; job public.generation_jobs;
BEGIN
    IF p_user_id IS NULL OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$'
        OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid generation request';
    END IF;
    SELECT * INTO request FROM internal.generation_requests WHERE user_id=p_user_id AND request_key=p_key;
    IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
    IF request.fingerprint <> p_fingerprint THEN RETURN '{"conflict":true}'::jsonb; END IF;
    SELECT * INTO job FROM public.generation_jobs WHERE id=request.job_id AND user_id=p_user_id;
    RETURN jsonb_build_object('job', to_jsonb(job));
END $$;

CREATE FUNCTION public.create_generation_request(p_user_id uuid, p_key text, p_fingerprint text, p_job jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE existing jsonb; job public.generation_jobs; doc_id uuid;
BEGIN
    -- Validates the key before acquiring locks and returns completed/failed jobs
    -- unchanged. Explicit /retry is the only way to restart a failed generation.
    existing := public.get_generation_request(p_user_id,p_key,p_fingerprint);
    IF existing <> '{}'::jsonb THEN RETURN existing; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_key, 8));
    existing := public.get_generation_request(p_user_id,p_key,p_fingerprint);
    IF existing <> '{}'::jsonb THEN RETURN existing; END IF;
    IF jsonb_typeof(p_job) IS DISTINCT FROM 'object' OR (p_job->>'user_id')::uuid IS DISTINCT FROM p_user_id
        OR jsonb_typeof(p_job->'generation_config') IS DISTINCT FROM 'object'
        OR p_job->'generation_config'->>'source_only' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid generation settings';
    END IF;
    doc_id := (p_job->>'document_id')::uuid;
    PERFORM 1 FROM public.documents WHERE id=doc_id AND user_id=p_user_id AND processing_status='READY'
        AND expires_at > now() FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Source unavailable'; END IF;
    INSERT INTO public.generation_jobs(id,user_id,document_id,status,stage,progress,message,generation_config)
        VALUES ((p_job->>'id')::uuid,p_user_id,doc_id,'PENDING','Reading document',5,
            'Initializing reviewer generation...',p_job->'generation_config') RETURNING * INTO job;
    INSERT INTO internal.generation_requests(user_id,request_key,fingerprint,job_id)
        VALUES(p_user_id,p_key,p_fingerprint,job.id);
    RETURN jsonb_build_object('job',to_jsonb(job));
END $$;

REVOKE ALL ON FUNCTION public.get_generation_request(uuid,text,text),
    public.create_generation_request(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_generation_request(uuid,text,text),
    public.create_generation_request(uuid,text,text,jsonb) TO service_role;
COMMIT;
