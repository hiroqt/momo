-- Durable background jobs and shared rate-limit state (WORK-01, WORK-02, SEC-01).
-- Apply after 001-005. Service-only invoker RPCs with fixed search paths; no
-- anonymous or authenticated client may read or mutate queue/limiter state.
-- Workers claim with FOR UPDATE SKIP LOCKED and hold renewable leases. Expired
-- leases are recovered on the next claim; exhausted jobs are dead-lettered and
-- their user-visible subject is moved to a controlled FAILED state.
BEGIN;

-- Internal infrastructure state lives outside the API-exposed public schema.
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO service_role;

CREATE TABLE IF NOT EXISTS internal.background_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    subject_id uuid NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'queued',
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    run_after timestamptz NOT NULL DEFAULT now(),
    lease_owner text,
    lease_expires_at timestamptz,
    heartbeat_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT background_jobs_kind_check CHECK (kind IN ('document_ingestion','study_generation')),
    CONSTRAINT background_jobs_status_check CHECK (status IN ('queued','running','succeeded','dead')),
    CONSTRAINT background_jobs_attempts_check CHECK (
        max_attempts BETWEEN 1 AND 10 AND attempts BETWEEN 0 AND max_attempts),
    CONSTRAINT background_jobs_lease_check CHECK (
        (status = 'running') = (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)),
    CONSTRAINT background_jobs_worker_check CHECK (
        lease_owner IS NULL OR lease_owner ~ '^[A-Za-z0-9._:-]{1,128}$'),
    -- Sanitized machine codes only; provider/SQL messages never reach this table.
    CONSTRAINT background_jobs_error_check CHECK (
        last_error IS NULL OR last_error ~ '^[A-Z][A-Z0-9_]{0,63}$'),
    CONSTRAINT background_jobs_payload_check CHECK (
        jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 16384),
    -- One logical job per subject: concurrent registration/re-delivery cannot fan out.
    CONSTRAINT background_jobs_subject_unique UNIQUE (kind, user_id, subject_id)
);
CREATE INDEX IF NOT EXISTS background_jobs_claim_idx
    ON internal.background_jobs(kind, run_after, created_at, id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS background_jobs_lease_idx
    ON internal.background_jobs(lease_expires_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS background_jobs_owner_idx
    ON internal.background_jobs(user_id, created_at DESC);

-- Sliding-window log shared by every API replica. Keys are category plus a
-- SHA-256 digest of the verified identity; raw identifiers are never stored.
CREATE TABLE IF NOT EXISTS internal.rate_limit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bucket_key text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT rate_limit_events_key_check CHECK (bucket_key ~ '^[a-z0-9_-]{1,32}:[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_idx
    ON internal.rate_limit_events(bucket_key, occurred_at);
CREATE INDEX IF NOT EXISTS rate_limit_events_occurred_idx
    ON internal.rate_limit_events(occurred_at);

DO $$
DECLARE t text; p record;
BEGIN
    FOREACH t IN ARRAY ARRAY['background_jobs','rate_limit_events'] LOOP
        -- No policies: RLS denies every non-bypass role even if a grant leaks.
        EXECUTE format('ALTER TABLE internal.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE internal.%I FORCE ROW LEVEL SECURITY', t);
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='internal' AND tablename=t LOOP
            EXECUTE format('DROP POLICY %I ON internal.%I', p.policyname, t);
        END LOOP;
        EXECUTE format('REVOKE ALL ON internal.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON internal.%I TO service_role', t);
    END LOOP;
END $$;
GRANT USAGE ON SEQUENCE internal.rate_limit_events_id_seq TO service_role;

-- Ingestion may finish only once. A late or duplicate worker cannot turn a READY
-- document back into FAILED/processing, and EXPIRED originals stay expired.
CREATE OR REPLACE FUNCTION public.guard_document_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF OLD.processing_status = 'EXPIRED' AND NEW.processing_status IS DISTINCT FROM 'EXPIRED' THEN
        NEW.processing_status := OLD.processing_status;
        NEW.processing_error := OLD.processing_error;
    ELSIF OLD.processing_status = 'READY' AND NEW.processing_status NOT IN ('READY','EXPIRED') THEN
        NEW.processing_status := OLD.processing_status;
        NEW.processing_error := OLD.processing_error;
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_document_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS document_status_monotonic ON public.documents;
CREATE TRIGGER document_status_monotonic BEFORE UPDATE OF processing_status ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.guard_document_status();

-- Controlled user-visible failure for a dead-lettered job. Never downgrades
-- completed work; uses the same safe messages as the workers.
CREATE OR REPLACE FUNCTION public.fail_background_job_subject(p_kind text, p_user_id uuid, p_subject_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF p_kind = 'document_ingestion' THEN
        UPDATE public.documents SET processing_status = 'FAILED',
            processing_error = 'The uploaded document could not be processed.', updated_at = now()
        WHERE id = p_subject_id AND user_id = p_user_id
            AND processing_status NOT IN ('READY','EXPIRED','FAILED');
    ELSIF p_kind = 'study_generation' THEN
        UPDATE public.generation_jobs SET status = 'FAILED', stage = 'Failed', progress = 100,
            message = 'An unexpected error occurred during reviewer generation.',
            error = 'Reviewer generation failed. Please retry.', updated_at = now()
        WHERE id = p_subject_id AND user_id = p_user_id
            AND status <> 'COMPLETED' AND study_set_id IS NULL;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_background_job(p_kind text, p_user_id uuid, p_subject_id uuid,
    p_payload jsonb DEFAULT '{}'::jsonb, p_max_attempts integer DEFAULT 3, p_requeue boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE job internal.background_jobs;
BEGIN
    IF p_kind IS NULL OR p_kind NOT IN ('document_ingestion','study_generation')
        OR p_user_id IS NULL OR p_subject_id IS NULL
        OR jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) IS DISTINCT FROM 'object'
        OR p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid background job';
    END IF;
    INSERT INTO internal.background_jobs(kind, user_id, subject_id, payload, max_attempts)
    VALUES (p_kind, p_user_id, p_subject_id, coalesce(p_payload, '{}'::jsonb), p_max_attempts)
    ON CONFLICT (kind, user_id, subject_id) DO NOTHING
    RETURNING * INTO job;
    IF FOUND THEN
        RETURN to_jsonb(job);
    END IF;
    SELECT * INTO job FROM internal.background_jobs
    WHERE kind = p_kind AND user_id = p_user_id AND subject_id = p_subject_id FOR UPDATE;
    -- Queued/running work is never duplicated. Finished work restarts only on an
    -- explicit retry that the caller has already authorized for its subject.
    IF p_requeue AND job.status IN ('succeeded','dead') THEN
        UPDATE internal.background_jobs SET status = 'queued', attempts = 0, max_attempts = p_max_attempts,
            payload = coalesce(p_payload, '{}'::jsonb), run_after = now(), last_error = NULL,
            completed_at = NULL, updated_at = now()
        WHERE id = job.id RETURNING * INTO job;
    END IF;
    RETURN to_jsonb(job);
END $$;

CREATE OR REPLACE FUNCTION public.claim_background_jobs(p_worker_id text, p_kinds text[],
    p_limit integer DEFAULT 1, p_lease_seconds integer DEFAULT 120, p_job_id uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE stale internal.background_jobs;
BEGIN
    IF p_worker_id IS NULL OR p_worker_id !~ '^[A-Za-z0-9._:-]{1,128}$'
        OR p_kinds IS NULL OR cardinality(p_kinds) = 0
        OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
        OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 15 AND 900 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid job claim';
    END IF;
    -- Recover leases abandoned by crashed or partitioned workers (bounded batch).
    FOR stale IN
        UPDATE internal.background_jobs j SET
            status = CASE WHEN j.attempts >= j.max_attempts THEN 'dead' ELSE 'queued' END,
            completed_at = CASE WHEN j.attempts >= j.max_attempts THEN now() ELSE NULL END,
            last_error = 'LEASE_EXPIRED', lease_owner = NULL, lease_expires_at = NULL,
            run_after = now(), updated_at = now()
        WHERE j.id IN (SELECT s.id FROM internal.background_jobs s
            WHERE s.status = 'running' AND s.lease_expires_at < now() AND s.kind = ANY(p_kinds)
            ORDER BY s.lease_expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)
        RETURNING j.*
    LOOP
        IF stale.status = 'dead' THEN
            PERFORM public.fail_background_job_subject(stale.kind, stale.user_id, stale.subject_id);
        END IF;
    END LOOP;
    RETURN QUERY
    WITH claimed AS (
        UPDATE internal.background_jobs j SET status = 'running', attempts = j.attempts + 1,
            lease_owner = p_worker_id, lease_expires_at = now() + make_interval(secs => p_lease_seconds),
            heartbeat_at = now(), updated_at = now()
        WHERE j.id IN (SELECT q.id FROM internal.background_jobs q
            WHERE q.status = 'queued' AND q.run_after <= now() AND q.kind = ANY(p_kinds)
                AND (p_job_id IS NULL OR q.id = p_job_id)
            ORDER BY q.run_after, q.created_at, q.id LIMIT p_limit FOR UPDATE SKIP LOCKED)
        RETURNING j.*
    ) SELECT to_jsonb(claimed) FROM claimed;
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_background_job(p_job_id uuid, p_worker_id text,
    p_lease_seconds integer DEFAULT 120)
RETURNS boolean LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 15 AND 900 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid lease';
    END IF;
    UPDATE internal.background_jobs SET lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        heartbeat_at = now(), updated_at = now()
    WHERE id = p_job_id AND status = 'running' AND lease_owner = p_worker_id;
    RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.complete_background_job(p_job_id uuid, p_worker_id text)
RETURNS boolean LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE internal.background_jobs SET status = 'succeeded', lease_owner = NULL, lease_expires_at = NULL,
        last_error = NULL, completed_at = now(), updated_at = now()
    WHERE id = p_job_id AND status = 'running' AND lease_owner = p_worker_id;
    RETURN FOUND;
END $$;

-- Returns the new status ('queued' for retry, 'dead' when exhausted/permanent),
-- or NULL when the caller no longer holds the lease.
CREATE OR REPLACE FUNCTION public.fail_background_job(p_job_id uuid, p_worker_id text, p_error_code text,
    p_retry_delay_seconds integer DEFAULT 30, p_permanent boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE job internal.background_jobs;
BEGIN
    IF p_error_code IS NULL OR p_error_code !~ '^[A-Z][A-Z0-9_]{0,63}$'
        OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds NOT BETWEEN 0 AND 3600 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid job failure';
    END IF;
    UPDATE internal.background_jobs j SET
        status = CASE WHEN p_permanent OR j.attempts >= j.max_attempts THEN 'dead' ELSE 'queued' END,
        completed_at = CASE WHEN p_permanent OR j.attempts >= j.max_attempts THEN now() ELSE NULL END,
        run_after = now() + make_interval(secs => p_retry_delay_seconds),
        last_error = p_error_code, lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE j.id = p_job_id AND j.status = 'running' AND j.lease_owner = p_worker_id
    RETURNING j.* INTO job;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    IF job.status = 'dead' THEN
        PERFORM public.fail_background_job_subject(job.kind, job.user_id, job.subject_id);
    END IF;
    RETURN job.status;
END $$;

-- Re-enqueue work whose API process crashed between persisting the subject and
-- enqueueing it. Only subjects without any queue row are touched.
CREATE OR REPLACE FUNCTION public.recover_orphaned_work(p_grace_seconds integer DEFAULT 300,
    p_limit integer DEFAULT 100, p_max_attempts integer DEFAULT 3)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE recovered integer := 0; added integer;
BEGIN
    IF p_grace_seconds IS NULL OR p_grace_seconds NOT BETWEEN 30 AND 86400
        OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
        OR p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid recovery parameters';
    END IF;
    -- A subject still in progress whose queue row is finished (for example an
    -- authorized retry that raced a finishing worker) is requeued as well.
    INSERT INTO internal.background_jobs AS b(kind, user_id, subject_id, max_attempts)
    SELECT 'document_ingestion', d.user_id, d.id, p_max_attempts FROM public.documents d
    WHERE d.processing_status IN ('UPLOADED','PROCESSING','VALIDATING','EXTRACTING','CHUNKING','EMBEDDING','INDEXING')
        AND d.updated_at < now() - make_interval(secs => p_grace_seconds) AND d.expires_at > now()
        AND NOT EXISTS (SELECT 1 FROM internal.background_jobs q WHERE q.kind = 'document_ingestion'
            AND q.user_id = d.user_id AND q.subject_id = d.id AND q.status IN ('queued','running'))
    ORDER BY d.updated_at LIMIT p_limit
    ON CONFLICT (kind, user_id, subject_id) DO UPDATE SET status = 'queued', attempts = 0,
        max_attempts = excluded.max_attempts, run_after = now(), last_error = NULL,
        completed_at = NULL, updated_at = now()
    WHERE b.status IN ('succeeded','dead');
    GET DIAGNOSTICS added = ROW_COUNT; recovered := recovered + added;
    INSERT INTO internal.background_jobs AS b(kind, user_id, subject_id, max_attempts)
    SELECT 'study_generation', g.user_id, g.id, p_max_attempts FROM public.generation_jobs g
    WHERE g.status IN ('PENDING','PROCESSING','GENERATING','VALIDATING') AND g.study_set_id IS NULL
        AND g.updated_at < now() - make_interval(secs => p_grace_seconds)
        AND NOT EXISTS (SELECT 1 FROM internal.background_jobs q WHERE q.kind = 'study_generation'
            AND q.user_id = g.user_id AND q.subject_id = g.id AND q.status IN ('queued','running'))
    ORDER BY g.updated_at LIMIT p_limit
    ON CONFLICT (kind, user_id, subject_id) DO UPDATE SET status = 'queued', attempts = 0,
        max_attempts = excluded.max_attempts, run_after = now(), last_error = NULL,
        completed_at = NULL, updated_at = now()
    WHERE b.status IN ('succeeded','dead');
    GET DIAGNOSTICS added = ROW_COUNT;
    RETURN recovered + added;
END $$;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_bucket_key text, p_limit integer,
    p_window_seconds integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE now_ts timestamptz := clock_timestamp(); used integer; oldest timestamptz;
BEGIN
    IF p_bucket_key IS NULL OR p_bucket_key !~ '^[a-z0-9_-]{1,32}:[0-9a-f]{64}$'
        OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000
        OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 3600 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid rate limit parameters';
    END IF;
    -- Serialize one bucket across replicas; other identities proceed concurrently.
    PERFORM pg_advisory_xact_lock(hashtextextended('rate_limit:' || p_bucket_key, 0));
    DELETE FROM internal.rate_limit_events
    WHERE bucket_key = p_bucket_key AND occurred_at <= now_ts - make_interval(secs => p_window_seconds);
    SELECT count(*)::integer, min(occurred_at) INTO used, oldest
    FROM internal.rate_limit_events WHERE bucket_key = p_bucket_key;
    IF used >= p_limit THEN
        RETURN jsonb_build_object('allowed', false, 'limit', p_limit, 'remaining', 0,
            'retry_after', greatest(1, ceil(extract(epoch FROM
                oldest + make_interval(secs => p_window_seconds) - now_ts)))::integer);
    END IF;
    INSERT INTO internal.rate_limit_events(bucket_key, occurred_at) VALUES (p_bucket_key, now_ts);
    -- Bounded pruning of abandoned buckets; windows never exceed one hour.
    DELETE FROM internal.rate_limit_events WHERE id IN (SELECT id FROM internal.rate_limit_events
        WHERE occurred_at < now_ts - interval '1 hour' ORDER BY occurred_at LIMIT 100);
    RETURN jsonb_build_object('allowed', true, 'limit', p_limit, 'remaining', p_limit - used - 1,
        'retry_after', 0);
END $$;

-- Retention monitoring: oldest overdue original still awaiting physical deletion.
CREATE OR REPLACE FUNCTION public.retention_backlog()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
    SELECT jsonb_build_object('overdue_count', count(*),
        'oldest_overdue_seconds', coalesce(floor(extract(epoch FROM now() - min(expires_at))), 0)::bigint)
    FROM public.documents WHERE expires_at <= now() AND processing_status <> 'EXPIRED'
$$;

DO $$
DECLARE f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.fail_background_job_subject(text,uuid,uuid)',
        'public.enqueue_background_job(text,uuid,uuid,jsonb,integer,boolean)',
        'public.claim_background_jobs(text,text[],integer,integer,uuid)',
        'public.heartbeat_background_job(uuid,text,integer)',
        'public.complete_background_job(uuid,text)',
        'public.fail_background_job(uuid,text,text,integer,boolean)',
        'public.recover_orphaned_work(integer,integer,integer)',
        'public.consume_rate_limit(text,integer,integer)',
        'public.retention_backlog()'] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END $$;

COMMIT;
