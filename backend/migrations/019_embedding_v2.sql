-- AI-03: add a separate 2048-dimensional index space without changing or
-- deleting the existing 1536-dimensional vectors or RPCs.
-- Rollback: leave this additive schema in place. Reverting the API is safe only
-- before v2 documents are published; afterward keep v2 code or re-embed those
-- documents into a compatible index before routing retrieval back to the v1 RPC.
BEGIN;

ALTER TABLE public.documents
    ADD COLUMN embedding_version smallint NOT NULL DEFAULT 1
    CHECK (embedding_version IN (1, 2));
ALTER TABLE public.document_chunks
    ADD COLUMN embedding_v2 extensions.vector(2048);

CREATE FUNCTION public.publish_document_index_v2(
    p_document_id uuid, p_user_id uuid, p_chunks jsonb,
    p_page_count integer, p_topics jsonb DEFAULT '[]'::jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE source public.documents; chunk jsonb;
BEGIN
    SELECT * INTO source FROM public.documents
        WHERE id=p_document_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR source.processing_status='EXPIRED' OR source.expires_at<=clock_timestamp() THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Document unavailable';
    END IF;
    IF source.processing_status='READY' THEN RETURN false; END IF;
    IF source.processing_status<>'INDEXING'
        OR jsonb_typeof(p_chunks) IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_chunks) NOT BETWEEN 1 AND 5000
        OR p_page_count IS NULL OR p_page_count NOT BETWEEN 1 AND 50
        OR jsonb_typeof(p_topics) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid document index';
    END IF;
    DELETE FROM public.document_chunks WHERE document_id=p_document_id AND user_id=p_user_id;
    FOR chunk IN SELECT value FROM jsonb_array_elements(p_chunks) LOOP
        IF jsonb_typeof(chunk) IS DISTINCT FROM 'object'
            OR nullif(btrim(chunk->>'content'),'') IS NULL
            OR (chunk->>'document_id')::uuid IS DISTINCT FROM p_document_id
            OR (chunk->>'user_id')::uuid IS DISTINCT FROM p_user_id
            OR (chunk->>'chunk_index')::integer IS NULL
            OR (chunk->>'chunk_index')::integer<0
            OR jsonb_typeof(chunk->'embedding') IS DISTINCT FROM 'array'
            OR jsonb_array_length(chunk->'embedding')<>2048 THEN
            RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid document index';
        END IF;
        INSERT INTO public.document_chunks(id,document_id,user_id,chunk_index,content,
            page_start,page_end,section,source_type,embedding_v2,metadata)
        VALUES ((chunk->>'id')::uuid,p_document_id,p_user_id,(chunk->>'chunk_index')::integer,
            chunk->>'content',(chunk->>'page_start')::integer,(chunk->>'page_end')::integer,
            chunk->>'section',chunk->>'source_type',(chunk->'embedding')::text::extensions.vector(2048),
            coalesce(chunk->'metadata','{}'::jsonb));
    END LOOP;
    IF (SELECT count(DISTINCT chunk_index) FROM public.document_chunks
        WHERE document_id=p_document_id AND user_id=p_user_id)<>jsonb_array_length(p_chunks) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid document index';
    END IF;
    UPDATE public.documents SET processing_status='READY',processing_error=NULL,
        page_count=p_page_count,suggested_topics=p_topics,embedding_version=2,updated_at=now()
    WHERE id=p_document_id AND user_id=p_user_id;
    RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.publish_document_index_v2(uuid,uuid,jsonb,integer,jsonb)
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_document_index_v2(uuid,uuid,jsonb,integer,jsonb)
    TO service_role;

-- Reindex legacy chunk text in bounded, retryable batches. Retrieval remains on
-- version 1 until finalize confirms every chunk for that document has v2 data.
CREATE FUNCTION public.reindex_document_chunk_embeddings_v2(
    p_document_id uuid, p_user_id uuid, p_chunks jsonb)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE source public.documents; item jsonb; changed integer;
BEGIN
    SELECT * INTO source FROM public.documents
        WHERE id=p_document_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR source.processing_status<>'READY' OR source.expires_at<=clock_timestamp()
        OR source.embedding_version<>1 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Document unavailable';
    END IF;
    IF jsonb_typeof(p_chunks) IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_chunks) NOT BETWEEN 1 AND 64
        OR (SELECT count(DISTINCT (value->>'chunk_index')::integer)
            FROM jsonb_array_elements(p_chunks))<>jsonb_array_length(p_chunks) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid embedding batch';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_chunks) LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'object'
            OR (item->>'chunk_index')::integer IS NULL OR (item->>'chunk_index')::integer<0
            OR jsonb_typeof(item->'embedding') IS DISTINCT FROM 'array'
            OR jsonb_array_length(item->'embedding')<>2048 THEN
            RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid embedding batch';
        END IF;
        UPDATE public.document_chunks SET embedding_v2=(item->'embedding')::text::extensions.vector(2048)
        WHERE document_id=p_document_id AND user_id=p_user_id
            AND chunk_index=(item->>'chunk_index')::integer;
        GET DIAGNOSTICS changed = ROW_COUNT;
        IF changed<>1 THEN
            RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid embedding batch';
        END IF;
    END LOOP;
    RETURN jsonb_array_length(p_chunks);
END $$;
REVOKE ALL ON FUNCTION public.reindex_document_chunk_embeddings_v2(uuid,uuid,jsonb)
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reindex_document_chunk_embeddings_v2(uuid,uuid,jsonb)
    TO service_role;

CREATE FUNCTION public.finalize_document_embedding_v2(p_document_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE source public.documents;
BEGIN
    SELECT * INTO source FROM public.documents
        WHERE id=p_document_id AND user_id=p_user_id FOR UPDATE;
    IF NOT FOUND OR source.processing_status<>'READY' OR source.expires_at<=clock_timestamp()
        OR source.embedding_version<>1 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Document unavailable';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.document_chunks
        WHERE document_id=p_document_id AND user_id=p_user_id)
        OR EXISTS (SELECT 1 FROM public.document_chunks
        WHERE document_id=p_document_id AND user_id=p_user_id AND embedding_v2 IS NULL) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Document index incomplete';
    END IF;
    UPDATE public.documents SET embedding_version=2,updated_at=now()
        WHERE id=p_document_id AND user_id=p_user_id;
    RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.finalize_document_embedding_v2(uuid,uuid)
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_document_embedding_v2(uuid,uuid)
    TO service_role;

CREATE FUNCTION public.match_document_chunks_v2(
    p_user_id uuid, p_query_embedding extensions.vector(2048),
    p_document_id uuid DEFAULT NULL, p_match_count integer DEFAULT 10,
    p_sections text[] DEFAULT NULL)
RETURNS TABLE(id uuid,document_id uuid,user_id uuid,chunk_index integer,content text,
    page_start integer,page_end integer,section text,source_type text,metadata jsonb,similarity double precision)
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT c.id,c.document_id,c.user_id,c.chunk_index,c.content,c.page_start,c.page_end,c.section,
        c.source_type,c.metadata,1-(c.embedding_v2 OPERATOR(extensions.<=>) p_query_embedding)
    FROM public.document_chunks c JOIN public.documents d ON d.id=c.document_id AND d.user_id=c.user_id
    WHERE c.user_id=p_user_id AND c.embedding_v2 IS NOT NULL AND d.embedding_version=2
        AND d.expires_at>now() AND d.processing_status='READY'
        AND (p_document_id IS NULL OR c.document_id=p_document_id)
        AND (p_sections IS NULL OR c.section=ANY(p_sections))
    ORDER BY c.embedding_v2 OPERATOR(extensions.<=>) p_query_embedding,c.id
    LIMIT greatest(1,least(coalesce(p_match_count,10),50))
$$;
REVOKE ALL ON FUNCTION public.match_document_chunks_v2(uuid,extensions.vector,uuid,integer,text[])
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks_v2(uuid,extensions.vector,uuid,integer,text[])
    TO service_role;

COMMIT;
