-- Cover owner-scoped composite foreign keys so parent deletes and FK checks
-- can find referencing rows without scanning child tables.
-- Rollback: drop the 14 indexes created below; table data and constraints remain intact.
BEGIN;

CREATE INDEX generation_requests_job_owner_idx
    ON internal.generation_requests(job_id, user_id);
CREATE INDEX chat_messages_session_owner_fk_idx
    ON public.chat_messages(session_id, user_id);
CREATE INDEX document_chunks_document_owner_fk_idx
    ON public.document_chunks(document_id, user_id);
CREATE INDEX economy_ledger_folder_owner_fk_idx
    ON public.economy_ledger(folder_id, user_id);
CREATE INDEX economy_ledger_item_owner_fk_idx
    ON public.economy_ledger(study_item_id, user_id);
CREATE INDEX generation_jobs_document_owner_fk_idx
    ON public.generation_jobs(document_id, user_id);
CREATE INDEX generation_jobs_set_owner_fk_idx
    ON public.generation_jobs(study_set_id, user_id);
CREATE INDEX learning_events_item_owner_fk_idx
    ON public.learning_events(item_id, user_id);
CREATE INDEX study_items_set_owner_fk_idx
    ON public.study_items(study_set_id, user_id, order_index);
CREATE INDEX study_sessions_set_owner_fk_idx
    ON public.study_sessions(study_set_id, user_id);
CREATE INDEX study_sets_document_owner_fk_idx
    ON public.study_sets(document_id, user_id);
CREATE INDEX study_sets_folder_owner_fk_idx
    ON public.study_sets(folder_id, user_id);
CREATE INDEX sync_events_item_owner_fk_idx
    ON public.sync_events(study_item_id, user_id);
CREATE INDEX sync_events_session_owner_fk_idx
    ON public.sync_events(study_session_id, user_id);

COMMIT;
