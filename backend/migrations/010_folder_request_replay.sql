-- API-01/SYNC-01: owner-scoped folder request replay, independent of pending economy activation.
BEGIN;
CREATE TABLE internal.folder_requests (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
    request_payload jsonb NOT NULL,
    folder_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(user_id,request_key)
);
-- Keep a tombstone after folder deletion so a late offline replay cannot recreate it.
ALTER TABLE internal.folder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.folder_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON internal.folder_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON internal.folder_requests TO service_role;
CREATE FUNCTION public.create_folder_request(p_user_id uuid,p_request_key text,p_name text,p_color text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE payload jsonb; prior internal.folder_requests; saved public.folders;
BEGIN
    IF p_user_id IS NULL OR p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9._:-]{1,128}$'
        OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 50
        OR length(p_color)>64 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid folder request';
    END IF;
    payload := jsonb_build_object('name',btrim(p_name),'color',p_color);
    -- Serializes same-owner/key requests across replicas. Hash collisions only serialize unrelated requests.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_request_key,0));
    SELECT * INTO prior FROM internal.folder_requests WHERE user_id=p_user_id AND request_key=p_request_key;
    IF FOUND THEN
        IF prior.request_payload IS DISTINCT FROM payload THEN
            RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_KEY_REUSED';
        END IF;
        SELECT * INTO saved FROM public.folders WHERE id=prior.folder_id AND user_id=p_user_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FOLDER_REQUEST_DELETED';
        END IF;
        RETURN to_jsonb(saved);
    END IF;
    INSERT INTO public.folders(user_id,name,color) VALUES(p_user_id,btrim(p_name),coalesce(p_color,'#4F46E5')) RETURNING * INTO saved;
    INSERT INTO internal.folder_requests(user_id,request_key,request_payload,folder_id)
        VALUES(p_user_id,p_request_key,payload,saved.id);
    RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.create_folder_request(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_folder_request(uuid,text,text,text) TO service_role;
COMMIT;
