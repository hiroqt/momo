-- RET-01: expose a bounded, read-only view for reconciling stored object locations.
BEGIN;
CREATE FUNCTION public.list_document_storage_objects(
    p_limit integer DEFAULT 100,
    p_after_name text DEFAULT NULL)
RETURNS TABLE(name text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid inventory page size';
    END IF;
    RETURN QUERY
    SELECT o.name
    FROM storage.objects o
    WHERE o.bucket_id='documents' AND (p_after_name IS NULL OR o.name>p_after_name)
    ORDER BY o.name
    LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION public.list_document_storage_objects(integer,text)
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_document_storage_objects(integer,text)
    TO service_role;

CREATE FUNCTION public.list_upload_object_inventory(
    p_limit integer DEFAULT 100,
    p_after_object_key text DEFAULT NULL)
RETURNS TABLE(object_key text, provider text, bucket text, status text, legacy boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid inventory page size';
    END IF;
    RETURN QUERY
    SELECT t.object_key,t.provider,t.bucket,t.status,t.legacy
    FROM internal.upload_tickets t
    WHERE p_after_object_key IS NULL OR t.object_key>p_after_object_key
    ORDER BY t.object_key
    LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION public.list_upload_object_inventory(integer,text)
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_upload_object_inventory(integer,text)
    TO service_role;
COMMIT;
