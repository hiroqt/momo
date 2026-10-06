-- Move pgvector out of the exposed application schema without dropping types,
-- existing embeddings or indexes. Explicit operator qualification avoids relying
-- on caller search_path or broadening the retrieval RPC's fixed search_path.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO service_role;

CREATE OR REPLACE FUNCTION public.match_document_chunks(
    p_user_id uuid, p_query_embedding extensions.vector(1536),
    p_document_id uuid DEFAULT NULL, p_match_count integer DEFAULT 10,
    p_sections text[] DEFAULT NULL)
RETURNS TABLE(id uuid,document_id uuid,user_id uuid,chunk_index integer,content text,
    page_start integer,page_end integer,section text,source_type text,metadata jsonb,similarity double precision)
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT c.id,c.document_id,c.user_id,c.chunk_index,c.content,c.page_start,c.page_end,c.section,
        c.source_type,c.metadata,1-(c.embedding OPERATOR(extensions.<=>) p_query_embedding)
    FROM public.document_chunks c JOIN public.documents d ON d.id=c.document_id AND d.user_id=c.user_id
    WHERE c.user_id=p_user_id AND c.embedding IS NOT NULL AND d.expires_at>now()
        AND (p_document_id IS NULL OR c.document_id=p_document_id)
        AND (p_sections IS NULL OR c.section=ANY(p_sections))
    ORDER BY c.embedding OPERATOR(extensions.<=>) p_query_embedding,c.id
    LIMIT greatest(1,least(coalesce(p_match_count,10),50))
$$;
REVOKE ALL ON FUNCTION public.match_document_chunks(uuid,extensions.vector,uuid,integer,text[])
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid,extensions.vector,uuid,integer,text[])
    TO service_role;
COMMIT;
