-- PostgreSQL 15+ / Supabase. Apply as the migration owner, in order after 001.
-- Add constraints before validation, then fail the transaction if historical
-- records are invalid. Audit and remediate those rows before retrying; never
-- silently discard or reassign user data during a security migration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL, name text NOT NULL,
    color text NOT NULL DEFAULT '#4F46E5',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
    title text NOT NULL DEFAULT 'Chat with Momo', message_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL,
    user_id uuid NOT NULL, role text NOT NULL, content text NOT NULL,
    citations jsonb, tool_calls jsonb, study_card jsonb, created_deck jsonb,
    image_base64 text, quick_replies jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.learning_events (
    id text PRIMARY KEY, user_id uuid NOT NULL, topic text NOT NULL,
    item_id uuid, question text NOT NULL, result text NOT NULL,
    user_answer text, occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS suggested_topics jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content_sha256 text;
ALTER TABLE public.study_sets ADD COLUMN IF NOT EXISTS folder_id uuid;
ALTER TABLE public.study_items ADD COLUMN IF NOT EXISTS image_base64 text;
ALTER TABLE public.study_items ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.study_items i SET user_id = s.user_id FROM public.study_sets s
WHERE i.study_set_id = s.id AND i.user_id IS NULL;
ALTER TABLE public.study_items ALTER COLUMN user_id SET NOT NULL;

-- Profile identity is Supabase Auth identity, not an arbitrary client UUID.
ALTER TABLE public.users ADD CONSTRAINT users_auth_identity_fk FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['documents','document_chunks','generation_jobs','study_sets',
        'study_items','study_sessions','sync_events','usage_records','folders',
        'chat_sessions','chat_messages','learning_events'] LOOP
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID', t, t || '_auth_owner_fk');
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

ALTER TABLE public.documents ADD CONSTRAINT documents_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE public.study_sets ADD CONSTRAINT study_sets_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE public.study_items ADD CONSTRAINT study_items_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE public.study_sessions ADD CONSTRAINT study_sessions_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE public.folders ADD CONSTRAINT folders_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE public.chat_sessions ADD CONSTRAINT chat_sessions_id_owner_unique UNIQUE (id, user_id);

ALTER TABLE public.document_chunks ADD CONSTRAINT chunks_document_owner_fk FOREIGN KEY (document_id,user_id)
    REFERENCES public.documents(id,user_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.study_sets ADD CONSTRAINT sets_document_owner_fk FOREIGN KEY (document_id,user_id)
    REFERENCES public.documents(id,user_id) ON DELETE SET NULL (document_id) NOT VALID;
ALTER TABLE public.study_sets ADD CONSTRAINT sets_folder_owner_fk FOREIGN KEY (folder_id,user_id)
    REFERENCES public.folders(id,user_id) ON DELETE SET NULL (folder_id) NOT VALID;
ALTER TABLE public.generation_jobs ADD CONSTRAINT jobs_document_owner_fk FOREIGN KEY (document_id,user_id)
    REFERENCES public.documents(id,user_id) ON DELETE SET NULL (document_id) NOT VALID;
ALTER TABLE public.generation_jobs ADD CONSTRAINT jobs_set_owner_fk FOREIGN KEY (study_set_id,user_id)
    REFERENCES public.study_sets(id,user_id) ON DELETE SET NULL (study_set_id) NOT VALID;
ALTER TABLE public.study_items ADD CONSTRAINT items_set_owner_fk FOREIGN KEY (study_set_id,user_id)
    REFERENCES public.study_sets(id,user_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.study_sessions ADD CONSTRAINT sessions_set_owner_fk FOREIGN KEY (study_set_id,user_id)
    REFERENCES public.study_sets(id,user_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.sync_events ADD CONSTRAINT sync_session_owner_fk FOREIGN KEY (study_session_id,user_id)
    REFERENCES public.study_sessions(id,user_id) ON DELETE SET NULL (study_session_id) NOT VALID;
ALTER TABLE public.sync_events ADD CONSTRAINT sync_item_owner_fk FOREIGN KEY (study_item_id,user_id)
    REFERENCES public.study_items(id,user_id) ON DELETE SET NULL (study_item_id) NOT VALID;
ALTER TABLE public.chat_messages ADD CONSTRAINT messages_session_owner_fk FOREIGN KEY (session_id,user_id)
    REFERENCES public.chat_sessions(id,user_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.learning_events ADD CONSTRAINT learning_item_owner_fk FOREIGN KEY (item_id,user_id)
    REFERENCES public.study_items(id,user_id) ON DELETE SET NULL (item_id) NOT VALID;

ALTER TABLE public.documents ADD CONSTRAINT document_limits_check CHECK (
    file_size > 0 AND file_size <= 15728640 AND page_count BETWEEN 0 AND 50
    AND file_type IN ('pdf','docx','txt','pptx')
    AND processing_status IN ('UPLOADED','PROCESSING','VALIDATING','EXTRACTING',
        'CHUNKING','EMBEDDING','INDEXING','READY','FAILED','EXPIRED')
    AND expires_at <= uploaded_at + interval '72 hours' AND expires_at > uploaded_at
    AND s3_object_key = 'documents/' || user_id::text || '/' || id::text || '/original.' || file_type
) NOT VALID;
ALTER TABLE public.documents ADD CONSTRAINT document_hash_check CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE public.document_chunks ADD CONSTRAINT chunks_index_check CHECK (chunk_index >= 0) NOT VALID;
ALTER TABLE public.generation_jobs ADD CONSTRAINT jobs_progress_check CHECK (progress BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE public.study_items ADD CONSTRAINT items_difficulty_check CHECK (difficulty IN ('easy','medium','hard')) NOT VALID;
ALTER TABLE public.study_sessions ADD CONSTRAINT sessions_counts_check CHECK (
    total_items >= 0 AND correct_count >= 0 AND incorrect_count >= 0
    AND correct_count + incorrect_count <= total_items AND score_percent BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE public.sync_events ADD CONSTRAINT sync_result_check CHECK (
    result IN ('correct','incorrect','review_again','skipped','mastered','review_later')) NOT VALID;
ALTER TABLE public.usage_records ADD CONSTRAINT usage_count_check CHECK (documents_count BETWEEN 0 AND 10) NOT VALID;
ALTER TABLE public.usage_records ADD CONSTRAINT usage_month_check CHECK (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') NOT VALID;
ALTER TABLE public.learning_events ADD CONSTRAINT learning_result_check CHECK (
    result IN ('correct','incorrect','mastered','review_later')) NOT VALID;
ALTER TABLE public.chat_messages ADD CONSTRAINT messages_role_check CHECK (role IN ('user','assistant')) NOT VALID;
ALTER TABLE public.chat_sessions ADD CONSTRAINT chat_count_check CHECK (message_count >= 0) NOT VALID;
ALTER TABLE public.folders ADD CONSTRAINT folder_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 100) NOT VALID;

-- Idempotency is scoped to the tenant; a guessed event ID must never suppress
-- another user's event or provide a uniqueness oracle across accounts.
ALTER TABLE public.sync_events DROP CONSTRAINT IF EXISTS sync_events_event_id_key;
DROP INDEX IF EXISTS public.idx_sync_events_event_id;
CREATE UNIQUE INDEX sync_events_owner_event_unique ON public.sync_events(user_id,event_id);
CREATE UNIQUE INDEX document_chunks_document_index_unique ON public.document_chunks(document_id,chunk_index);
CREATE INDEX documents_owner_created_idx ON public.documents(user_id,created_at DESC,id);
CREATE INDEX study_sets_owner_created_idx ON public.study_sets(user_id,created_at DESC,id);
CREATE INDEX study_sets_folder_idx ON public.study_sets(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX items_set_order_idx ON public.study_items(study_set_id,order_index,id);
CREATE INDEX sessions_owner_created_idx ON public.study_sessions(user_id,created_at DESC,id);
CREATE INDEX sync_owner_occurred_idx ON public.sync_events(user_id,occurred_at DESC);
CREATE INDEX folders_owner_created_idx ON public.folders(user_id,created_at,id);
CREATE UNIQUE INDEX folders_owner_normalized_name_unique ON public.folders(user_id,lower(btrim(name)));
CREATE INDEX chat_sessions_owner_updated_idx ON public.chat_sessions(user_id,updated_at DESC,id);
CREATE INDEX chat_messages_session_created_idx ON public.chat_messages(session_id,created_at,id);
CREATE INDEX learning_events_owner_occurred_idx ON public.learning_events(user_id,occurred_at DESC);
CREATE INDEX chunks_owner_document_idx ON public.document_chunks(user_id,document_id);
CREATE INDEX documents_owner_hash_idx ON public.documents(user_id,content_sha256) WHERE content_sha256 IS NOT NULL;
CREATE INDEX study_sets_document_idx ON public.study_sets(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX jobs_document_idx ON public.generation_jobs(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX jobs_study_set_idx ON public.generation_jobs(study_set_id) WHERE study_set_id IS NOT NULL;
CREATE INDEX sessions_study_set_idx ON public.study_sessions(study_set_id);
CREATE INDEX sync_session_idx ON public.sync_events(study_session_id) WHERE study_session_id IS NOT NULL;
CREATE INDEX sync_item_idx ON public.sync_events(study_item_id) WHERE study_item_id IS NOT NULL;
CREATE INDEX learning_item_idx ON public.learning_events(item_id) WHERE item_id IS NOT NULL;

DO $$
DECLARE t text; p record;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','documents','document_chunks','generation_jobs','study_sets',
        'study_items','study_sessions','sync_events','usage_records','folders',
        'chat_sessions','chat_messages','learning_events'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
        END LOOP;
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
        EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
        EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (%I = (SELECT auth.uid()))',t,
            CASE WHEN t='users' THEN 'id' ELSE 'user_id' END);
    END LOOP;
END $$;

-- Fill derived item ownership server-side, but reject an explicitly wrong owner.
CREATE FUNCTION public.set_study_item_owner() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        SELECT s.user_id INTO NEW.user_id FROM public.study_sets s WHERE s.id=NEW.study_set_id;
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_study_item_owner() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER study_item_owner_before_write BEFORE INSERT OR UPDATE ON public.study_items
    FOR EACH ROW EXECUTE FUNCTION public.set_study_item_owner();

CREATE FUNCTION public.register_document(p_document jsonb,p_monthly_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE owner_id uuid := (p_document->>'user_id')::uuid;
    document_id uuid := (p_document->>'id')::uuid;
    month_key text := to_char(now() AT TIME ZONE 'UTC','YYYY-MM');
    stored public.documents; consumed integer;
BEGIN
    IF owner_id IS NULL OR document_id IS NULL OR p_monthly_limit IS NULL OR p_monthly_limit NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid registration parameters';
    END IF;
    -- Serialize retries of this document before quota consumption.
    PERFORM pg_advisory_xact_lock(hashtextextended(document_id::text,0));
    SELECT * INTO stored FROM public.documents WHERE id=document_id;
    IF FOUND THEN
        IF stored.user_id <> owner_id THEN
            RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Document unavailable';
        END IF;
        RETURN to_jsonb(stored);
    END IF;
    INSERT INTO public.usage_records(user_id,year_month,documents_count)
    VALUES(owner_id,month_key,1)
    ON CONFLICT(user_id,year_month) DO UPDATE SET
        documents_count=public.usage_records.documents_count+1,updated_at=now()
    WHERE public.usage_records.documents_count < p_monthly_limit
    RETURNING documents_count INTO consumed;
    IF consumed IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='MONTHLY_DOCUMENT_LIMIT';
    END IF;
    INSERT INTO public.documents(id,user_id,original_filename,file_type,mime_type,file_size,
        s3_object_key,uploaded_at,expires_at,processing_status)
    VALUES(document_id,owner_id,p_document->>'original_filename',p_document->>'file_type',
        p_document->>'mime_type',(p_document->>'file_size')::bigint,p_document->>'s3_object_key',
        now(),now()+interval '72 hours','UPLOADED') RETURNING * INTO stored;
    RETURN to_jsonb(stored);
END $$;

CREATE FUNCTION public.process_sync_batch(p_user_id uuid,p_events jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE accepted_ids jsonb; accepted integer;
BEGIN
    IF p_user_id IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_events)>100 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid sync batch';
    END IF;
    -- Validate even duplicate events; retries cannot smuggle cross-tenant refs.
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_events) e WHERE
        NULLIF(e->>'event_id','') IS NULL OR
        ((e->>'study_item_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.study_items i
            WHERE i.id=(e->>'study_item_id')::uuid AND i.user_id=p_user_id)) OR
        ((e->>'study_session_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.study_sessions s
            WHERE s.id=(e->>'study_session_id')::uuid AND s.user_id=p_user_id)) OR
        ((e->>'study_session_id') IS NOT NULL AND (e->>'study_item_id') IS NOT NULL
            AND NOT EXISTS(SELECT 1 FROM public.study_items i JOIN public.study_sessions s
                ON i.study_set_id=s.study_set_id WHERE i.id=(e->>'study_item_id')::uuid
                AND s.id=(e->>'study_session_id')::uuid AND i.user_id=p_user_id AND s.user_id=p_user_id))
    ) THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Study reference unavailable';
    END IF;
    WITH inserted AS (
        INSERT INTO public.sync_events(event_id,user_id,study_session_id,study_item_id,result,user_answer,occurred_at)
        SELECT e->>'event_id',p_user_id,(e->>'study_session_id')::uuid,(e->>'study_item_id')::uuid,
            e->>'result',e->>'user_answer',(e->>'occurred_at')::timestamptz
        FROM jsonb_array_elements(p_events) e ON CONFLICT(user_id,event_id) DO NOTHING
        RETURNING *
    ), learning AS (
        INSERT INTO public.learning_events(id,user_id,topic,item_id,question,result,user_answer,occurred_at)
        SELECT 'sync:' || e.user_id::text || ':' || e.event_id,e.user_id,
            coalesce(s.title,'General Concepts'),e.study_item_id,
            coalesce(i.question,'Study review'),
            CASE WHEN e.result='review_again' THEN 'review_later' ELSE e.result END,
            e.user_answer,e.occurred_at
        FROM inserted e LEFT JOIN public.study_items i ON i.id=e.study_item_id AND i.user_id=e.user_id
            LEFT JOIN public.study_sets s ON s.id=i.study_set_id AND s.user_id=e.user_id
        WHERE e.result <> 'skipped' ON CONFLICT (id) DO NOTHING
        RETURNING id
    ) SELECT count(*)::integer,coalesce(jsonb_agg(event_id),'[]'::jsonb) INTO accepted,accepted_ids FROM inserted;
    RETURN jsonb_build_object('accepted_count',accepted,'ignored_duplicates_count',jsonb_array_length(p_events)-accepted,
        'accepted_event_ids',accepted_ids);
END $$;

CREATE FUNCTION public.match_document_chunks(p_user_id uuid,p_query_embedding vector(1536),
    p_document_id uuid DEFAULT NULL,p_match_count integer DEFAULT 10,p_sections text[] DEFAULT NULL)
RETURNS TABLE(id uuid,document_id uuid,user_id uuid,chunk_index integer,content text,
    page_start integer,page_end integer,section text,source_type text,metadata jsonb,similarity double precision)
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT c.id,c.document_id,c.user_id,c.chunk_index,c.content,c.page_start,c.page_end,c.section,
        c.source_type,c.metadata,1-(c.embedding <=> p_query_embedding)
    FROM public.document_chunks c JOIN public.documents d ON d.id=c.document_id AND d.user_id=c.user_id
    WHERE c.user_id=p_user_id AND c.embedding IS NOT NULL AND d.expires_at>now()
        AND (p_document_id IS NULL OR c.document_id=p_document_id)
        AND (p_sections IS NULL OR c.section=ANY(p_sections))
    ORDER BY c.embedding <=> p_query_embedding,c.id
    LIMIT greatest(1,least(coalesce(p_match_count,10),50))
$$;
REVOKE ALL ON FUNCTION public.register_document(jsonb,integer),
    public.process_sync_batch(uuid,jsonb),
    public.match_document_chunks(uuid,vector,uuid,integer,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_document(jsonb,integer),
    public.process_sync_batch(uuid,jsonb),
    public.match_document_chunks(uuid,vector,uuid,integer,text[]) TO service_role;

CREATE FUNCTION public.list_folders_with_counts(p_user_id uuid,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,user_id uuid,name text,color text,created_at timestamptz,updated_at timestamptz,reviewer_count integer)
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT f.id,f.user_id,f.name,f.color,f.created_at,f.updated_at,
        (SELECT count(*)::integer FROM public.study_sets s WHERE s.folder_id=f.id AND s.user_id=f.user_id)
    FROM public.folders f WHERE f.user_id=p_user_id
    ORDER BY f.created_at,f.id
    LIMIT greatest(1,least(coalesce(p_limit,100),100)) OFFSET greatest(coalesce(p_offset,0),0)
$$;
REVOKE ALL ON FUNCTION public.list_folders_with_counts(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_folders_with_counts(uuid,integer,integer) TO service_role;

CREATE FUNCTION public.learning_statistics(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT jsonb_build_object(
        'total_reviews',(SELECT count(*) FROM public.learning_events WHERE user_id=p_user_id),
        'correct_count',(SELECT count(*) FROM public.learning_events WHERE user_id=p_user_id AND result IN ('correct','mastered')),
        'topics',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.topic) FROM (
            SELECT topic,count(*) AS total,
                count(*) FILTER (WHERE result IN ('correct','mastered')) AS correct,
                count(*) FILTER (WHERE result NOT IN ('correct','mastered')) AS missed
            FROM public.learning_events WHERE user_id=p_user_id GROUP BY topic
        ) t),'[]'::jsonb),
        'recent_missed_events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC,e.id DESC) FROM (
            SELECT id,topic,question,user_answer,occurred_at,result FROM public.learning_events
            WHERE user_id=p_user_id AND result='incorrect' ORDER BY occurred_at DESC,id DESC LIMIT 20
        ) e),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.learning_statistics(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.learning_statistics(uuid) TO service_role;

CREATE FUNCTION public.activity_dates(p_user_id uuid)
RETURNS TABLE(activity_date date) LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT DISTINCT (occurred_at AT TIME ZONE 'UTC')::date AS activity_date
    FROM public.sync_events WHERE user_id=p_user_id
    ORDER BY activity_date DESC
$$;
REVOKE ALL ON FUNCTION public.activity_dates(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activity_dates(uuid) TO service_role;

-- Finalize once per owned job. Database errors roll back the set, every item,
-- and the completion marker together; concurrent/restarted workers reuse it.
CREATE FUNCTION public.persist_generated_study_set(p_job_id uuid,p_user_id uuid,p_set jsonb,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE job public.generation_jobs; saved public.study_sets;
    new_set_id uuid; source_id uuid; item_total integer;
BEGIN
    IF p_user_id IS NULL OR p_job_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid generation finalization';
    END IF;
    SELECT * INTO job FROM public.generation_jobs WHERE id=p_job_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Generation unavailable';
    END IF;
    IF job.study_set_id IS NOT NULL THEN
        SELECT * INTO saved FROM public.study_sets WHERE id=job.study_set_id AND user_id=p_user_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Study material unavailable';
        END IF;
        UPDATE public.generation_jobs SET status='COMPLETED',stage='Completed',progress=100,
            message='Your study material is ready.',error=NULL,updated_at=now() WHERE id=p_job_id;
        RETURN to_jsonb(saved);
    END IF;
    IF job.status='COMPLETED' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Completed study material unavailable';
    END IF;
    IF jsonb_typeof(p_set) IS DISTINCT FROM 'object' OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid study material';
    END IF;
    item_total := jsonb_array_length(p_items);
    IF item_total NOT BETWEEN 1 AND 100 OR NULLIF(btrim(p_set->>'title'),'') IS NULL
        OR (p_set ? 'user_id' AND (p_set->>'user_id')::uuid IS DISTINCT FROM p_user_id)
        OR (p_set ? 'item_count' AND (p_set->>'item_count')::integer IS DISTINCT FROM item_total)
        OR (p_set ? 'generation_config' AND jsonb_typeof(p_set->'generation_config') IS DISTINCT FROM 'object')
        OR (coalesce(p_set->'generation_config',job.generation_config) ? 'source_only'
            AND coalesce(p_set->'generation_config',job.generation_config)->'source_only' IS DISTINCT FROM 'true'::jsonb) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid study material requirements';
    END IF;
    new_set_id := coalesce((p_set->>'id')::uuid,gen_random_uuid());
    source_id := (p_set->>'document_id')::uuid;
    IF source_id IS DISTINCT FROM job.document_id THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Source reference unavailable';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE
        jsonb_typeof(i) IS DISTINCT FROM 'object' OR
        NULLIF(btrim(i->>'type'),'') IS NULL OR NULLIF(btrim(i->>'question'),'') IS NULL OR
        NULLIF(btrim(i->>'answer'),'') IS NULL OR
        (i ? 'user_id' AND (i->>'user_id')::uuid IS DISTINCT FROM p_user_id) OR
        (i ? 'study_set_id' AND (i->>'study_set_id')::uuid IS DISTINCT FROM new_set_id) OR
        jsonb_typeof(i->'source_metadata') IS DISTINCT FROM 'object' OR
        NOT (i->'source_metadata' ? 'page' OR i->'source_metadata' ? 'section') OR
        ((i->'source_metadata'->>'document_id') IS NOT NULL AND NOT EXISTS(
            SELECT 1 FROM public.documents d WHERE d.id=(i->'source_metadata'->>'document_id')::uuid AND d.user_id=p_user_id))
    ) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid validated study item';
    END IF;
    INSERT INTO public.study_sets(id,user_id,document_id,folder_id,title,description,
        generation_config,generation_status,item_count)
    VALUES(new_set_id,p_user_id,source_id,(p_set->>'folder_id')::uuid,p_set->>'title',
        p_set->>'description',coalesce(p_set->'generation_config',job.generation_config),'COMPLETED',item_total)
    RETURNING * INTO saved;
    INSERT INTO public.study_items(id,user_id,study_set_id,type,question,answer,explanation,options,
        difficulty,source_metadata,order_index,image_base64)
    SELECT coalesce((i->>'id')::uuid,gen_random_uuid()),p_user_id,new_set_id,
        i->>'type',i->>'question',i->>'answer',i->>'explanation',i->'options',
        coalesce(i->>'difficulty','medium'),i->'source_metadata',(ordinality-1)::integer,i->>'image_base64'
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(i,ordinality);
    UPDATE public.generation_jobs SET study_set_id=new_set_id,status='COMPLETED',stage='Completed',
        progress=100,message='Your study material is ready.',error=NULL,updated_at=now() WHERE id=p_job_id;
    RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.persist_generated_study_set(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_generated_study_set(uuid,uuid,jsonb,jsonb) TO service_role;

-- Keep originals private; backend-issued signed URLs implement object access.
-- Restrictive policies compose with existing storage policies without changing
-- permissions on other buckets. Authenticated users cannot bypass upload quotas
-- by directly inserting into the document bucket through the Storage API.
DO $$
BEGIN
    IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
        INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
        VALUES('documents','documents',false,15728640,ARRAY[
            'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
        ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,
            allowed_mime_types=excluded.allowed_mime_types;
        EXECUTE $policy$ CREATE POLICY study_documents_read_boundary ON storage.objects AS RESTRICTIVE
            FOR SELECT TO anon,authenticated USING (
                bucket_id <> 'documents' OR
                ((SELECT auth.uid()) IS NOT NULL AND split_part(name,'/',1)='documents'
                    AND split_part(name,'/',2)=(SELECT auth.uid())::text)) $policy$;
        EXECUTE $policy$ CREATE POLICY study_documents_insert_boundary ON storage.objects AS RESTRICTIVE
            FOR INSERT TO anon,authenticated WITH CHECK (bucket_id <> 'documents') $policy$;
        EXECUTE $policy$ CREATE POLICY study_documents_update_boundary ON storage.objects AS RESTRICTIVE
            FOR UPDATE TO anon,authenticated USING (bucket_id <> 'documents')
            WITH CHECK (bucket_id <> 'documents') $policy$;
        EXECUTE $policy$ CREATE POLICY study_documents_delete_boundary ON storage.objects AS RESTRICTIVE
            FOR DELETE TO anon,authenticated USING (bucket_id <> 'documents') $policy$;
    END IF;
END $$;

-- No half-secured deployment: pre-existing invalid records abort this entire
-- transaction and require explicit remediation rather than remaining exposed.
DO $$
DECLARE c record;
BEGIN
    FOR c IN SELECT conrelid::regclass AS relation, conname FROM pg_constraint
        WHERE connamespace='public'::regnamespace AND NOT convalidated
        AND (conname = ANY(ARRAY['users_auth_identity_fk','chunks_document_owner_fk',
            'sets_document_owner_fk','sets_folder_owner_fk','jobs_document_owner_fk',
            'jobs_set_owner_fk','items_set_owner_fk','sessions_set_owner_fk',
            'sync_session_owner_fk','sync_item_owner_fk','messages_session_owner_fk',
            'learning_item_owner_fk','document_limits_check','document_hash_check',
            'chunks_index_check','jobs_progress_check','items_difficulty_check',
            'sessions_counts_check','sync_result_check','usage_count_check','usage_month_check',
            'learning_result_check','messages_role_check','chat_count_check','folder_name_check'])
            OR conname = ANY(ARRAY['documents_auth_owner_fk','document_chunks_auth_owner_fk',
            'generation_jobs_auth_owner_fk','study_sets_auth_owner_fk','study_items_auth_owner_fk',
            'study_sessions_auth_owner_fk','sync_events_auth_owner_fk','usage_records_auth_owner_fk',
            'folders_auth_owner_fk','chat_sessions_auth_owner_fk','chat_messages_auth_owner_fk',
            'learning_events_auth_owner_fk'])) LOOP
        EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',c.relation,c.conname);
    END LOOP;
END $$;

COMMIT;
