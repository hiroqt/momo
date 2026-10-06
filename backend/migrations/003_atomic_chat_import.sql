-- Append validated chat cards without replacing earlier cards or double-importing retries.
-- Service-only invoker RPC; tenant checks remain mandatory despite service-role RLS bypass.
CREATE FUNCTION public.persist_chat_card(p_user_id uuid,p_title text,p_document_id uuid,
    p_set_id uuid,p_item_id uuid,p_item jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE saved public.study_sets; source public.documents; chunk public.document_chunks;
    existing public.study_items; next_order integer;
BEGIN
    IF p_user_id IS NULL OR p_document_id IS NULL OR p_set_id IS NULL OR p_item_id IS NULL
        OR nullif(btrim(p_title),'') IS NULL OR length(p_title)>255
        OR jsonb_typeof(p_item) IS DISTINCT FROM 'object'
        OR nullif(btrim(p_item->>'question'),'') IS NULL OR nullif(btrim(p_item->>'answer'),'') IS NULL
        OR p_item->>'type' IS NULL OR p_item->>'type' NOT IN ('flashcard','multiple_choice','true_false','identification','fill_in_the_blank',
            'glossary','concept_outline','cheat_sheet','compare_contrast','qa_study_sheet','timeline_process','summary','qa','explanation','topic_explanation')
        OR jsonb_typeof(p_item->'source_metadata') IS DISTINCT FROM 'object'
        OR (p_item->'source_metadata'->>'document_id')::uuid IS DISTINCT FROM p_document_id
        OR coalesce(p_item->>'difficulty','medium') NOT IN ('easy','medium','hard') THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid validated chat card';
    END IF;
    SELECT * INTO source FROM public.documents WHERE id=p_document_id AND user_id=p_user_id
        AND processing_status='READY' AND expires_at>now() FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Source unavailable';
    END IF;
    SELECT * INTO chunk FROM public.document_chunks WHERE id=(p_item->'source_metadata'->>'chunk_id')::uuid
        AND document_id=p_document_id AND user_id=p_user_id FOR SHARE;
    IF NOT FOUND OR (p_item->'source_metadata'->>'page')::integer IS DISTINCT FROM chunk.page_start
        OR p_item->'source_metadata'->>'section' IS DISTINCT FROM coalesce(chunk.section,'General')
        OR p_item->'source_metadata'->>'snippet' IS DISTINCT FROM left(btrim(chunk.content),200) THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Evidence unavailable';
    END IF;
    -- Serialize both initial creation and appends for one owner/title.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||btrim(p_title),0));
    SELECT * INTO saved FROM public.study_sets WHERE user_id=p_user_id AND title=btrim(p_title)
        ORDER BY created_at,id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO public.study_sets(id,user_id,document_id,title,description,generation_config,item_count)
        VALUES(p_set_id,p_user_id,p_document_id,btrim(p_title),'Imported verified cards from Momo conversation',
            '{"source_only":true}'::jsonb,0) RETURNING * INTO saved;
    END IF;
    IF saved.user_id IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Study material unavailable';
    END IF;
    SELECT * INTO existing FROM public.study_items WHERE id=p_item_id;
    IF FOUND THEN
        IF existing.user_id IS DISTINCT FROM p_user_id OR existing.study_set_id IS DISTINCT FROM saved.id THEN
            RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Study item unavailable';
        END IF;
    ELSE
        SELECT coalesce(max(order_index),-1)+1 INTO next_order FROM public.study_items
            WHERE study_set_id=saved.id AND user_id=p_user_id;
        INSERT INTO public.study_items(id,user_id,study_set_id,type,question,answer,explanation,options,difficulty,source_metadata,order_index)
        VALUES(p_item_id,p_user_id,saved.id,p_item->>'type',p_item->>'question',p_item->>'answer',
            p_item->>'explanation',p_item->'options',coalesce(p_item->>'difficulty','medium'),p_item->'source_metadata',next_order);
    END IF;
    UPDATE public.study_sets SET item_count=(SELECT count(*) FROM public.study_items WHERE study_set_id=saved.id AND user_id=p_user_id),
        updated_at=now() WHERE id=saved.id AND user_id=p_user_id RETURNING * INTO saved;
    RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.persist_chat_card(uuid,text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_chat_card(uuid,text,uuid,uuid,uuid,jsonb) TO service_role;

-- Save a validated chat-generated deck and all of its items in one transaction.
-- The deterministic set id makes lost-response retries return the same deck.
-- Every item must cite an owned chunk of the owned, READY, unexpired source.
CREATE FUNCTION public.persist_chat_deck(p_user_id uuid,p_document_id uuid,p_set_id uuid,
    p_set jsonb,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE saved public.study_sets; item_total integer;
BEGIN
    IF p_user_id IS NULL OR p_document_id IS NULL OR p_set_id IS NULL
        OR jsonb_typeof(p_set) IS DISTINCT FROM 'object' OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
        OR nullif(btrim(p_set->>'title'),'') IS NULL OR length(p_set->>'title')>255
        OR jsonb_typeof(p_set->'generation_config') IS DISTINCT FROM 'object'
        OR p_set->'generation_config'->'source_only' IS DISTINCT FROM 'true'::jsonb THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid validated chat deck';
    END IF;
    item_total := jsonb_array_length(p_items);
    IF item_total NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid validated chat deck';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('momo-chat-deck:'||p_set_id::text,0));
    SELECT * INTO saved FROM public.study_sets WHERE id=p_set_id;
    IF FOUND THEN
        IF saved.user_id IS DISTINCT FROM p_user_id THEN
            RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Study material unavailable';
        END IF;
        RETURN to_jsonb(saved);
    END IF;
    PERFORM 1 FROM public.documents WHERE id=p_document_id AND user_id=p_user_id
        AND processing_status='READY' AND expires_at>now() FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Source unavailable';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE
        jsonb_typeof(i) IS DISTINCT FROM 'object'
        OR nullif(btrim(i->>'question'),'') IS NULL OR nullif(btrim(i->>'answer'),'') IS NULL
        OR i->>'type' IS NULL OR i->>'type' NOT IN ('flashcard','multiple_choice','true_false','identification','fill_in_the_blank',
            'glossary','concept_outline','cheat_sheet','compare_contrast','qa_study_sheet','timeline_process','summary','qa','topic_explanation')
        OR coalesce(i->>'difficulty','medium') NOT IN ('easy','medium','hard')
        OR jsonb_typeof(i->'source_metadata') IS DISTINCT FROM 'object'
        OR i->'source_metadata'->>'document_id' IS DISTINCT FROM p_document_id::text) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid validated chat deck';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE NOT EXISTS(
        SELECT 1 FROM public.document_chunks c
        WHERE c.id::text=i->'source_metadata'->>'chunk_id' AND c.document_id=p_document_id AND c.user_id=p_user_id
            AND (i->'source_metadata'->>'page')::integer IS NOT DISTINCT FROM c.page_start
            AND i->'source_metadata'->>'section' IS NOT DISTINCT FROM coalesce(c.section,'General')
            AND i->'source_metadata'->>'snippet' IS NOT DISTINCT FROM left(btrim(c.content,E' \t\r\n\f\013'),200))) THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Evidence unavailable';
    END IF;
    INSERT INTO public.study_sets(id,user_id,document_id,title,description,generation_config,generation_status,item_count)
    VALUES(p_set_id,p_user_id,p_document_id,btrim(p_set->>'title'),p_set->>'description',
        p_set->'generation_config','COMPLETED',item_total)
    RETURNING * INTO saved;
    INSERT INTO public.study_items(id,user_id,study_set_id,type,question,answer,explanation,options,difficulty,source_metadata,order_index)
    SELECT gen_random_uuid(),p_user_id,p_set_id,i->>'type',i->>'question',i->>'answer',i->>'explanation',
        i->'options',coalesce(i->>'difficulty','medium'),i->'source_metadata',(ordinality-1)::integer
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(i,ordinality);
    RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.persist_chat_deck(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_chat_deck(uuid,uuid,uuid,jsonb,jsonb) TO service_role;
