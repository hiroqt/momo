-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Users table (mirrors Supabase auth.users or standalone for app user profiles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Documents table (Original files stored in S3 for 3 days)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'docx', 'txt', 'pptx'
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    page_count INT DEFAULT 0,
    s3_object_key TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- uploaded_at + INTERVAL '3 days'
    processing_status TEXT NOT NULL DEFAULT 'UPLOADED',
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);

-- 3. Document Chunks (Indexed with pgvector for grounded retrieval)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    page_start INT,
    page_end INT,
    section TEXT,
    source_type TEXT,
    embedding VECTOR(1536), -- Pluggable embedding size (1536 standard OpenAI/NVIDIA, adjustable)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON document_chunks(user_id);

-- 4. Generation Jobs (Tracks async background processing & progress)
CREATE TABLE IF NOT EXISTS generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    study_set_id UUID,
    status TEXT NOT NULL DEFAULT 'PENDING',
    stage TEXT NOT NULL DEFAULT 'Created',
    progress INT NOT NULL DEFAULT 0,
    message TEXT DEFAULT 'Initializing...',
    error TEXT,
    generation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);

-- 5. Study Sets (Persistent! Retained even after original S3 document deletes)
CREATE TABLE IF NOT EXISTS study_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL, -- Document delete must NOT delete study set
    title TEXT NOT NULL,
    description TEXT,
    generation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    generation_status TEXT NOT NULL DEFAULT 'COMPLETED',
    item_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_sets_user_id ON study_sets(user_id);

-- 6. Study Items (Grounded questions, flashcards, explanations)
CREATE TABLE IF NOT EXISTS study_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'flashcard', 'multiple_choice', 'true_false', 'identification', 'fill_in_the_blank', 'summary', 'qa', 'topic_explanation'
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT,
    options JSONB, -- Array of strings for MCQ
    difficulty TEXT NOT NULL DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- { document_id, page, section, text_snippet }
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_items_set_id ON study_items(study_set_id);

-- 7. Study Sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    mode TEXT NOT NULL, -- 'flashcards', 'quiz', 'exam'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_items INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    incorrect_count INT NOT NULL DEFAULT 0,
    score_percent DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);

-- 8. Sync Events (Idempotent offline event synchronization)
CREATE TABLE IF NOT EXISTS sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL, -- Client-generated UUID for idempotency
    user_id UUID NOT NULL,
    study_session_id UUID,
    study_item_id UUID,
    result TEXT NOT NULL, -- 'correct', 'incorrect', 'review_again', 'skipped'
    user_answer TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_events_user_id ON sync_events(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_events_event_id ON sync_events(event_id);

-- 9. Monthly Usage Records (Enforces 10 documents / month quota server-side)
CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    year_month TEXT NOT NULL, -- 'YYYY-MM'
    documents_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_year_month UNIQUE(user_id, year_month)
);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_month ON usage_records(user_id, year_month);

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
