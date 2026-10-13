-- WORK-02: automatic orphan reconciliation has a lifetime budget distinct from
-- per-run handler retries. Only an explicitly authorized manual retry resets it.
BEGIN;
ALTER TABLE internal.background_jobs ADD COLUMN orphan_recoveries integer NOT NULL DEFAULT 0
    CHECK (orphan_recoveries BETWEEN 0 AND 10);
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
        UPDATE internal.background_jobs SET status = 'queued', attempts = 0, orphan_recoveries = 0, max_attempts = p_max_attempts,
            payload = coalesce(p_payload, '{}'::jsonb), run_after = now(), last_error = NULL,
            completed_at = NULL, updated_at = now()
        WHERE id = job.id RETURNING * INTO job;
    END IF;
    RETURN to_jsonb(job);
END $$;

CREATE OR REPLACE FUNCTION public.recover_orphaned_work(p_grace_seconds integer DEFAULT 300,
    p_limit integer DEFAULT 100, p_max_attempts integer DEFAULT 3)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE candidate record; job internal.background_jobs; recovered integer := 0; eligible boolean; inserted boolean;
BEGIN
    IF p_grace_seconds IS NULL OR p_grace_seconds NOT BETWEEN 30 AND 86400
        OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
        OR p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid recovery parameters';
    END IF;
    FOR candidate IN
        SELECT * FROM (
            SELECT 'document_ingestion'::text AS kind,d.user_id,d.id AS subject_id,d.updated_at
            FROM public.documents d
            WHERE d.processing_status IN ('UPLOADED','PROCESSING','VALIDATING','EXTRACTING','CHUNKING','EMBEDDING','INDEXING')
                AND d.expires_at>clock_timestamp()
                AND d.updated_at<now()-make_interval(secs=>p_grace_seconds)
            UNION ALL
            SELECT 'study_generation',g.user_id,g.id,g.updated_at FROM public.generation_jobs g
            WHERE g.status IN ('PENDING','PROCESSING','GENERATING','VALIDATING') AND g.study_set_id IS NULL
                AND g.updated_at<now()-make_interval(secs=>p_grace_seconds)
        ) subjects
        WHERE NOT EXISTS (SELECT 1 FROM internal.background_jobs q
            WHERE q.kind=subjects.kind AND q.user_id=subjects.user_id AND q.subject_id=subjects.subject_id
                AND q.status IN ('queued','running'))
        ORDER BY updated_at,kind,subject_id LIMIT p_limit
    LOOP
        -- Skip another reconciler's subject rather than waiting behind its batch.
        IF NOT pg_try_advisory_xact_lock(hashtextextended(
            'orphan:'||candidate.kind||':'||candidate.user_id||':'||candidate.subject_id,0)) THEN CONTINUE; END IF;
        -- Queue before subject matches fail_background_job's lock order.
        inserted := false;
        SELECT * INTO job FROM internal.background_jobs
            WHERE kind=candidate.kind AND user_id=candidate.user_id AND subject_id=candidate.subject_id FOR UPDATE;
        IF NOT FOUND THEN
            INSERT INTO internal.background_jobs(kind,user_id,subject_id,max_attempts,orphan_recoveries)
            VALUES(candidate.kind,candidate.user_id,candidate.subject_id,p_max_attempts,1)
            ON CONFLICT(kind,user_id,subject_id) DO NOTHING RETURNING * INTO job;
            inserted := FOUND;
            IF NOT inserted THEN
                SELECT * INTO job FROM internal.background_jobs
                    WHERE kind=candidate.kind AND user_id=candidate.user_id AND subject_id=candidate.subject_id FOR UPDATE;
            END IF;
        END IF;
        IF NOT inserted AND job.status IN ('queued','running') THEN CONTINUE; END IF;
        -- Recheck lifecycle under the subject lock: no revival after expiry,
        -- successful completion, controlled failure, or an ownership change.
        eligible := false;
        IF candidate.kind='document_ingestion' THEN
            SELECT true INTO eligible FROM public.documents d
            WHERE d.id=candidate.subject_id AND d.user_id=candidate.user_id
                AND d.processing_status IN ('UPLOADED','PROCESSING','VALIDATING','EXTRACTING','CHUNKING','EMBEDDING','INDEXING')
                AND d.expires_at>clock_timestamp()
                AND d.updated_at<now()-make_interval(secs=>p_grace_seconds) FOR UPDATE;
        ELSE
            SELECT true INTO eligible FROM public.generation_jobs g
            WHERE g.id=candidate.subject_id AND g.user_id=candidate.user_id
                AND g.status IN ('PENDING','PROCESSING','GENERATING','VALIDATING') AND g.study_set_id IS NULL
                AND g.updated_at<now()-make_interval(secs=>p_grace_seconds) FOR UPDATE;
        END IF;
        IF eligible IS DISTINCT FROM true THEN
            -- This uncommitted row was created solely for recovery; terminal
            -- or expired subjects never leave an enqueued job behind.
            IF inserted THEN DELETE FROM internal.background_jobs WHERE id=job.id; END IF;
            CONTINUE;
        END IF;
        IF inserted THEN
            recovered:=recovered+1;
        ELSIF job.status IN ('succeeded','dead') THEN
            IF job.orphan_recoveries>=job.max_attempts THEN
                UPDATE internal.background_jobs SET status='dead',last_error='ORPHAN_RECOVERY_EXHAUSTED',
                    completed_at=now(),updated_at=now() WHERE id=job.id;
                PERFORM public.fail_background_job_subject(candidate.kind,candidate.user_id,candidate.subject_id);
            ELSE
                UPDATE internal.background_jobs SET status='queued',attempts=0,
                    orphan_recoveries=orphan_recoveries+1,run_after=now(),last_error=NULL,
                    completed_at=NULL,updated_at=now() WHERE id=job.id;
                recovered:=recovered+1;
            END IF;
        END IF;
    END LOOP;
    RETURN recovered;
END $$;
REVOKE ALL ON FUNCTION public.recover_orphaned_work(integer,integer,integer),
    public.enqueue_background_job(text,uuid,uuid,jsonb,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_orphaned_work(integer,integer,integer),
    public.enqueue_background_job(text,uuid,uuid,jsonb,integer,boolean) TO service_role;
COMMIT;
