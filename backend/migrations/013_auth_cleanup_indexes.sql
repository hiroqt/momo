-- Bound Auth-user deletion cascades and ticket retirement to the affected owner's rows.
BEGIN;
CREATE INDEX chat_messages_owner_idx ON public.chat_messages(user_id);
CREATE INDEX study_items_owner_idx ON public.study_items(user_id);
CREATE INDEX upload_tickets_auth_ref_idx ON internal.upload_tickets(auth_ref)
    WHERE auth_ref IS NOT NULL;
COMMIT;
