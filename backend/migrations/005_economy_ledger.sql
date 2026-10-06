-- Server-authoritative hearts/XP/credits ledger (PRD 6.6/6.7, tracker ECON-01).
-- Apply after 001-004. Amounts are computed by the backend economy policy and
-- passed to service-only RPCs; clients never write balances or choose prices.
-- PRD-fixed rules enforced here: five-heart maximum, no negative balances, and
-- the progressive folder price (folders 1-3 free; Nth folder, N >= 4, costs
-- 50 + (N - 4) * 25 credits). Idempotency is scoped to (user_id, key).
BEGIN;

CREATE TABLE public.economy_wallets (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    hearts integer NOT NULL DEFAULT 5,
    credits bigint NOT NULL DEFAULT 0,
    xp bigint NOT NULL DEFAULT 0,
    hearts_refreshed_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT economy_wallet_bounds_check CHECK (
        hearts BETWEEN 0 AND 5 AND credits >= 0 AND xp >= 0 AND version >= 0)
);

CREATE TABLE public.economy_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    kind text NOT NULL,
    hearts_delta integer NOT NULL DEFAULT 0,
    credits_delta bigint NOT NULL DEFAULT 0,
    xp_delta bigint NOT NULL DEFAULT 0,
    hearts_after integer NOT NULL,
    credits_after bigint NOT NULL,
    xp_after bigint NOT NULL,
    study_item_id uuid,
    folder_id uuid,
    request_fingerprint text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT economy_ledger_owner_key_unique UNIQUE (user_id, idempotency_key),
    CONSTRAINT economy_ledger_wallet_fk FOREIGN KEY (user_id)
        REFERENCES public.economy_wallets(user_id) ON DELETE CASCADE,
    CONSTRAINT economy_ledger_item_owner_fk FOREIGN KEY (study_item_id, user_id)
        REFERENCES public.study_items(id, user_id) ON DELETE SET NULL (study_item_id),
    CONSTRAINT economy_ledger_folder_owner_fk FOREIGN KEY (folder_id, user_id)
        REFERENCES public.folders(id, user_id) ON DELETE SET NULL (folder_id),
    CONSTRAINT economy_ledger_key_check CHECK (length(idempotency_key) BETWEEN 1 AND 160),
    CONSTRAINT economy_ledger_kind_check CHECK (kind IN ('heart_loss','heart_refill',
        'heart_regen','xp_reward','credit_reward','xp_conversion','cosmetic_purchase',
        'folder_purchase','adjustment')),
    CONSTRAINT economy_ledger_after_check CHECK (
        hearts_after BETWEEN 0 AND 5 AND credits_after >= 0 AND xp_after >= 0)
);
CREATE INDEX economy_ledger_owner_created_idx ON public.economy_ledger(user_id, created_at DESC, id);
CREATE INDEX economy_ledger_item_idx ON public.economy_ledger(study_item_id) WHERE study_item_id IS NOT NULL;
CREATE INDEX economy_ledger_folder_idx ON public.economy_ledger(folder_id) WHERE folder_id IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['economy_wallets','economy_ledger'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
        EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role', t);
        EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))', t);
    END LOOP;
END $$;

-- PRD 6.6 folder price for the next folder given the current folder count.
CREATE FUNCTION public.folder_credit_cost(p_existing_count integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
BEGIN
    IF p_existing_count IS NULL OR p_existing_count < 0 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid folder count';
    END IF;
    -- The new folder's ordinal is N = count + 1; N <= 3 is free.
    IF p_existing_count < 3 THEN
        RETURN 0;
    END IF;
    RETURN 50 + ((p_existing_count + 1) - 4) * 25;
END $$;

-- Lock (creating on first use) the owner's wallet and apply time regeneration.
-- A NULL interval means the regeneration policy is not configured: no hearts
-- are granted. Callers must already hold no other economy row locks.
CREATE FUNCTION public.economy_lock_wallet(p_user_id uuid, p_heart_regen_seconds integer)
RETURNS public.economy_wallets LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE w public.economy_wallets; gained integer; new_hearts integer; old_hearts integer;
BEGIN
    IF p_user_id IS NULL OR (p_heart_regen_seconds IS NOT NULL AND p_heart_regen_seconds NOT BETWEEN 60 AND 604800) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid economy parameters';
    END IF;
    INSERT INTO public.economy_wallets(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO w FROM public.economy_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF p_heart_regen_seconds IS NOT NULL AND w.hearts < 5 THEN
        gained := floor(extract(epoch FROM (now() - w.hearts_refreshed_at)) / p_heart_regen_seconds)::integer;
        IF gained > 0 THEN
            old_hearts := w.hearts;
            new_hearts := least(5, w.hearts + gained);
            UPDATE public.economy_wallets SET
                hearts = new_hearts,
                hearts_refreshed_at = CASE WHEN new_hearts = 5 THEN now()
                    ELSE w.hearts_refreshed_at + make_interval(secs => gained::double precision * p_heart_regen_seconds) END,
                version = version + 1, updated_at = now()
            WHERE user_id = p_user_id RETURNING * INTO w;
            INSERT INTO public.economy_ledger(user_id, idempotency_key, kind, hearts_delta,
                hearts_after, credits_after, xp_after, request_fingerprint)
            VALUES (p_user_id, 'regen:' || gen_random_uuid()::text, 'heart_regen', new_hearts - old_hearts,
                w.hearts, w.credits, w.xp, 'system');
        END IF;
    END IF;
    RETURN w;
END $$;

CREATE FUNCTION public.economy_wallet_json(w public.economy_wallets)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
    SELECT jsonb_build_object('hearts', w.hearts, 'max_hearts', 5, 'credits', w.credits, 'xp', w.xp,
        'hearts_refreshed_at', w.hearts_refreshed_at, 'version', w.version,
        'folder_count', (SELECT count(*)::integer FROM public.folders f WHERE f.user_id = w.user_id),
        'next_folder_cost', public.folder_credit_cost(
            (SELECT count(*)::integer FROM public.folders f WHERE f.user_id = w.user_id)))
$$;

CREATE FUNCTION public.get_economy_wallet(p_user_id uuid, p_heart_regen_seconds integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE w public.economy_wallets;
BEGIN
    w := public.economy_lock_wallet(p_user_id, p_heart_regen_seconds);
    RETURN public.economy_wallet_json(w);
END $$;

-- Apply one server-computed entry. Replays with the same key and request
-- return the original entry; a reused key with a different request fails.
CREATE FUNCTION public.apply_economy_entry(p_user_id uuid, p_idempotency_key text, p_kind text,
    p_hearts_delta integer, p_credits_delta bigint, p_xp_delta bigint,
    p_study_item_id uuid DEFAULT NULL, p_folder_id uuid DEFAULT NULL,
    p_heart_regen_seconds integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE w public.economy_wallets; entry public.economy_ledger; fingerprint text;
    h integer := coalesce(p_hearts_delta, 0); c bigint := coalesce(p_credits_delta, 0);
    x bigint := coalesce(p_xp_delta, 0);
BEGIN
    IF p_user_id IS NULL OR nullif(btrim(p_idempotency_key), '') IS NULL OR length(p_idempotency_key) > 160
        OR p_kind IS NULL OR p_kind NOT IN ('heart_loss','heart_refill','xp_reward','credit_reward',
            'xp_conversion','cosmetic_purchase','adjustment')
        OR (p_kind = 'heart_loss' AND (h <> -1 OR c <> 0 OR x <> 0))
        OR (p_kind = 'heart_refill' AND (h <= 0 OR c > 0 OR x > 0 OR (c = 0 AND x = 0)))
        OR (p_kind = 'xp_reward' AND (x <= 0 OR h <> 0 OR c <> 0))
        OR (p_kind = 'credit_reward' AND (c <= 0 OR h <> 0 OR x <> 0))
        OR (p_kind = 'xp_conversion' AND (x >= 0 OR h < 0 OR c < 0 OR (h = 0 AND c = 0)))
        OR (p_kind = 'cosmetic_purchase' AND (c >= 0 OR h <> 0 OR x <> 0))
        OR abs(h) > 5 OR abs(c) > 1000000 OR abs(x) > 1000000 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid economy entry';
    END IF;
    fingerprint := md5(jsonb_build_object('kind', p_kind, 'hearts', h, 'credits', c, 'xp', x,
        'study_item_id', p_study_item_id, 'folder_id', p_folder_id)::text);
    w := public.economy_lock_wallet(p_user_id, p_heart_regen_seconds);
    SELECT * INTO entry FROM public.economy_ledger WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF entry.request_fingerprint IS DISTINCT FROM fingerprint THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='IDEMPOTENCY_KEY_REUSED';
        END IF;
        RETURN jsonb_build_object('replayed', true, 'entry', to_jsonb(entry), 'wallet', public.economy_wallet_json(w));
    END IF;
    IF p_study_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.study_items i
        WHERE i.id = p_study_item_id AND i.user_id = p_user_id) THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Study reference unavailable';
    END IF;
    IF p_folder_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.folders f
        WHERE f.id = p_folder_id AND f.user_id = p_user_id) THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Folder reference unavailable';
    END IF;
    IF w.hearts + h < 0 THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INSUFFICIENT_HEARTS';
    ELSIF w.hearts + h > 5 THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='HEARTS_FULL';
    ELSIF w.credits + c < 0 THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INSUFFICIENT_CREDITS';
    ELSIF w.xp + x < 0 THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INSUFFICIENT_XP';
    END IF;
    UPDATE public.economy_wallets SET hearts = hearts + h, credits = credits + c, xp = xp + x,
        -- Start the regeneration clock when a full wallet loses its first heart.
        hearts_refreshed_at = CASE WHEN w.hearts = 5 AND h < 0 THEN now() ELSE hearts_refreshed_at END,
        version = version + 1, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO w;
    INSERT INTO public.economy_ledger(user_id, idempotency_key, kind, hearts_delta, credits_delta, xp_delta,
        hearts_after, credits_after, xp_after, study_item_id, folder_id, request_fingerprint)
    VALUES (p_user_id, p_idempotency_key, p_kind, h, c, x, w.hearts, w.credits, w.xp,
        p_study_item_id, p_folder_id, fingerprint) RETURNING * INTO entry;
    RETURN jsonb_build_object('replayed', false, 'entry', to_jsonb(entry), 'wallet', public.economy_wallet_json(w));
END $$;

-- Create a folder and charge its PRD price in one transaction. The wallet lock
-- serializes concurrent purchases so each folder is priced at its true ordinal.
CREATE FUNCTION public.create_folder_with_charge(p_user_id uuid, p_idempotency_key text,
    p_name text, p_color text DEFAULT NULL, p_heart_regen_seconds integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE w public.economy_wallets; entry public.economy_ledger; created public.folders;
    fingerprint text; existing integer; cost integer; clean_name text := btrim(p_name);
BEGIN
    IF p_user_id IS NULL OR nullif(btrim(p_idempotency_key), '') IS NULL OR length(p_idempotency_key) > 160
        OR clean_name IS NULL OR length(clean_name) NOT BETWEEN 1 AND 100
        OR (p_color IS NOT NULL AND length(p_color) > 32) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid folder purchase';
    END IF;
    fingerprint := md5(jsonb_build_object('kind', 'folder_purchase', 'name', lower(clean_name),
        'color', p_color)::text);
    w := public.economy_lock_wallet(p_user_id, p_heart_regen_seconds);
    SELECT * INTO entry FROM public.economy_ledger WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF entry.request_fingerprint IS DISTINCT FROM fingerprint THEN
            RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='IDEMPOTENCY_KEY_REUSED';
        END IF;
        SELECT * INTO created FROM public.folders WHERE id = entry.folder_id AND user_id = p_user_id;
        RETURN jsonb_build_object('replayed', true, 'entry', to_jsonb(entry),
            'folder', CASE WHEN created.id IS NULL THEN NULL ELSE to_jsonb(created) END,
            'wallet', public.economy_wallet_json(w));
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
    RETURN jsonb_build_object('replayed', false, 'entry', to_jsonb(entry), 'folder', to_jsonb(created),
        'wallet', public.economy_wallet_json(w));
END $$;

REVOKE ALL ON FUNCTION public.folder_credit_cost(integer),
    public.economy_lock_wallet(uuid, integer),
    public.economy_wallet_json(public.economy_wallets),
    public.get_economy_wallet(uuid, integer),
    public.apply_economy_entry(uuid, text, text, integer, bigint, bigint, uuid, uuid, integer),
    public.create_folder_with_charge(uuid, text, text, text, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folder_credit_cost(integer),
    public.economy_lock_wallet(uuid, integer),
    public.economy_wallet_json(public.economy_wallets),
    public.get_economy_wallet(uuid, integer),
    public.apply_economy_entry(uuid, text, text, integer, bigint, bigint, uuid, uuid, integer),
    public.create_folder_with_charge(uuid, text, text, text, integer)
    TO service_role;

COMMIT;
