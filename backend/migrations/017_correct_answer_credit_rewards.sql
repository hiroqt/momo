-- ECON-01: reward one Momo Coin for each newly accepted client-attested correct answer.
-- The event insert and ledger update share a transaction; duplicate sync IDs do not reward twice.
CREATE FUNCTION public.reward_correct_sync_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.result = 'correct' THEN
        IF NEW.study_item_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Correct sync events require a study item';
        END IF;
        PERFORM public.apply_economy_entry(
            NEW.user_id,
            'sync_correct:' || NEW.event_id,
            'credit_reward',
            0,
            1,
            0,
            NEW.study_item_id,
            NULL,
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reward_correct_sync_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_correct_sync_event() TO service_role;

CREATE TRIGGER sync_correct_credit_reward
AFTER INSERT ON public.sync_events
FOR EACH ROW
EXECUTE FUNCTION public.reward_correct_sync_event();
