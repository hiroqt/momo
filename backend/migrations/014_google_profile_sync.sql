-- Provision display-only application profiles from verified Google Auth users.
-- auth.users remains the identity source; profile metadata is never authority.
BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_google_auth_profile(
    profile_id uuid,
    auth_email text,
    app_metadata jsonb,
    user_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    profile_email text := NULLIF(btrim(auth_email), '');
    profile_name text;
    profile_avatar text;
BEGIN
    -- Keep the app's Google-only identity policy aligned with API JWT checks.
    IF app_metadata->>'provider' IS DISTINCT FROM 'google'
       OR app_metadata->'providers' IS DISTINCT FROM '["google"]'::jsonb
       OR profile_email IS NULL THEN
        RETURN;
    END IF;

    profile_name := regexp_replace(
        coalesce(
            NULLIF(btrim(user_metadata->>'full_name'), ''),
            NULLIF(btrim(user_metadata->>'name'), ''),
            ''
        ),
        '[[:cntrl:]]', '', 'g'
    );
    profile_name := NULLIF(left(btrim(profile_name), 200), '');

    profile_avatar := coalesce(
        NULLIF(btrim(user_metadata->>'avatar_url'), ''),
        NULLIF(btrim(user_metadata->>'picture'), '')
    );
    IF profile_avatar IS NULL
       OR char_length(profile_avatar) > 2048
       OR profile_avatar !~* '^https://([a-z0-9-]+\.)*googleusercontent\.com(/|\?|#|$)' THEN
        profile_avatar := NULL;
    END IF;

    BEGIN
        INSERT INTO public.users(id, email, full_name, avatar_url)
        VALUES (profile_id, profile_email, profile_name, profile_avatar)
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = now();
    EXCEPTION WHEN unique_violation THEN
        -- A profile collision must never bind one Auth identity to another
        -- account's email or make an otherwise valid Google sign-in fail.
        RETURN;
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_google_auth_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    PERFORM public.upsert_google_auth_profile(
        NEW.id, NEW.email, NEW.raw_app_meta_data, NEW.raw_user_meta_data
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_google_auth_profile(uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_google_auth_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_google_auth_profile() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS auth_user_google_profile_sync ON auth.users;
CREATE TRIGGER auth_user_google_profile_sync
    AFTER INSERT OR UPDATE OF email, raw_app_meta_data, raw_user_meta_data
    ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_google_auth_profile();

-- Install first: CREATE TRIGGER locks auth.users against writes until backfill commits.
SELECT public.upsert_google_auth_profile(id, email, raw_app_meta_data, raw_user_meta_data)
FROM auth.users
WHERE raw_app_meta_data->>'provider' = 'google'
  AND raw_app_meta_data->'providers' = '["google"]'::jsonb
  AND NULLIF(btrim(email), '') IS NOT NULL;

COMMIT;
