-- ECON-01: activate the PRD folder price without breaking queued offline creates.
-- Keep folder creation and its charge/replay record in one transaction.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_folder_with_charge(p_user_id uuid, p_idempotency_key text,
    p_name text, p_color text DEFAULT NULL, p_heart_regen_seconds integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE w public.economy_wallets; entry public.economy_ledger; created public.folders;
    prior internal.folder_requests; payload jsonb; fingerprint text; existing integer; cost integer;
    clean_name text := btrim(p_name);
BEGIN
    IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{1,128}$'
        OR clean_name IS NULL OR length(clean_name) NOT BETWEEN 1 AND 50
        OR length(p_color) > 64 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid folder purchase';
    END IF;
    payload := jsonb_build_object('name', clean_name, 'color', p_color);
    fingerprint := md5(jsonb_build_object('kind', 'folder_purchase', 'name', lower(clean_name),
        'color', p_color)::text);

    -- Serialize all creates for this account on the wallet row before counting folders.
    w := public.economy_lock_wallet(p_user_id, p_heart_regen_seconds);
    SELECT * INTO prior FROM internal.folder_requests
        WHERE user_id = p_user_id AND request_key = p_idempotency_key;
    IF FOUND THEN
        IF prior.request_payload IS DISTINCT FROM payload THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='IDEMPOTENCY_KEY_REUSED';
        END IF;
        SELECT * INTO created FROM public.folders WHERE id = prior.folder_id AND user_id = p_user_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FOLDER_REQUEST_DELETED';
        END IF;
        -- Requests recorded before pricing remain free when retried after rollout.
        RETURN jsonb_build_object('replayed', true, 'legacy_replay', true, 'entry', NULL,
            'folder', to_jsonb(created), 'wallet', public.economy_wallet_json(w));
    END IF;

    SELECT * INTO entry FROM public.economy_ledger
        WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF entry.request_fingerprint IS DISTINCT FROM fingerprint THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='IDEMPOTENCY_KEY_REUSED';
        END IF;
        SELECT * INTO created FROM public.folders WHERE id = entry.folder_id AND user_id = p_user_id;
        IF created.id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FOLDER_REQUEST_DELETED';
        END IF;
        INSERT INTO internal.folder_requests(user_id, request_key, request_payload, folder_id)
            VALUES (p_user_id, p_idempotency_key, payload, created.id);
        RETURN jsonb_build_object('replayed', true, 'legacy_replay', false, 'entry', to_jsonb(entry),
            'folder', to_jsonb(created), 'wallet', public.economy_wallet_json(w));
    END IF;

    SELECT count(*)::integer INTO existing FROM public.folders WHERE user_id = p_user_id;
    cost := public.folder_credit_cost(existing);
    IF w.credits < cost THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INSUFFICIENT_CREDITS';
    END IF;
    INSERT INTO public.folders(user_id, name, color)
        VALUES (p_user_id, clean_name, coalesce(p_color, '#4F46E5')) RETURNING * INTO created;
    UPDATE public.economy_wallets SET credits = credits - cost, version = version + 1, updated_at = now()
        WHERE user_id = p_user_id RETURNING * INTO w;
    INSERT INTO public.economy_ledger(user_id, idempotency_key, kind, credits_delta,
        hearts_after, credits_after, xp_after, folder_id, request_fingerprint)
        VALUES (p_user_id, p_idempotency_key, 'folder_purchase', -cost, w.hearts, w.credits, w.xp,
            created.id, fingerprint) RETURNING * INTO entry;
    INSERT INTO internal.folder_requests(user_id, request_key, request_payload, folder_id)
        VALUES (p_user_id, p_idempotency_key, payload, created.id);
    RETURN jsonb_build_object('replayed', false, 'legacy_replay', false, 'entry', to_jsonb(entry),
        'folder', to_jsonb(created), 'wallet', public.economy_wallet_json(w));
END $$;

-- Keep requests already in flight on an older API replica on the same priced path.
CREATE OR REPLACE FUNCTION public.create_folder_request(p_user_id uuid, p_request_key text,
    p_name text, p_color text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE result jsonb;
BEGIN
    result := public.create_folder_with_charge(p_user_id, p_request_key, p_name, p_color, NULL);
    RETURN result->'folder';
END $$;

COMMIT;
