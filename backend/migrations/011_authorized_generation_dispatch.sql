-- Consume explicit generation retry authorization and queue reset together.
-- Apply after 001-010. Queue-before-subject locking matches worker completion.
BEGIN;
CREATE FUNCTION public.enqueue_generation_retry(p_user_id uuid,p_subject_id uuid,
    p_revision timestamptz,p_max_attempts integer DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE subject public.generation_jobs; queued jsonb; queue_row internal.background_jobs;
    inserted_queue boolean := false;
BEGIN
    IF p_user_id IS NULL OR p_subject_id IS NULL OR p_revision IS NULL
        OR p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid retry dispatch';
    END IF;
    -- Fast denial does not touch another user's queue or create a queue row.
    PERFORM 1 FROM public.generation_jobs WHERE id=p_subject_id AND user_id=p_user_id
        AND status='PENDING' AND retry_dispatch_pending AND updated_at=p_revision;
    IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
    -- Lock an existing queue first. A missing queue is tentative until the
    -- subject is rechecked under lock; remove only our own tentative insertion
    -- if that authorization disappeared while acquiring the queue lock.
    SELECT * INTO queue_row FROM internal.background_jobs WHERE kind='study_generation'
        AND user_id=p_user_id AND subject_id=p_subject_id FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO internal.background_jobs(kind,user_id,subject_id,max_attempts)
            VALUES('study_generation',p_user_id,p_subject_id,p_max_attempts)
            ON CONFLICT(kind,user_id,subject_id) DO NOTHING RETURNING * INTO queue_row;
        inserted_queue := FOUND;
        IF NOT inserted_queue THEN
            SELECT * INTO queue_row FROM internal.background_jobs WHERE kind='study_generation'
                AND user_id=p_user_id AND subject_id=p_subject_id FOR UPDATE;
        END IF;
    END IF;
    SELECT * INTO subject FROM public.generation_jobs WHERE id=p_subject_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR subject.status IS DISTINCT FROM 'PENDING'
        OR subject.retry_dispatch_pending IS DISTINCT FROM true OR subject.updated_at IS DISTINCT FROM p_revision THEN
        IF inserted_queue THEN DELETE FROM internal.background_jobs WHERE id=queue_row.id; END IF;
        RETURN '{}'::jsonb;
    END IF;
    queued := public.enqueue_background_job('study_generation',p_user_id,p_subject_id,'{}'::jsonb,p_max_attempts,true);
    UPDATE public.generation_jobs SET retry_dispatch_pending=false WHERE id=p_subject_id AND user_id=p_user_id;
    RETURN queued;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_generation_retry(uuid,uuid,timestamptz,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_generation_retry(uuid,uuid,timestamptz,integer) TO service_role;
COMMIT;
