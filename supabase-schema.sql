-- Run this in the Supabase SQL Editor to create the analytics table

CREATE TABLE IF NOT EXISTS deck_sessions (
    id TEXT PRIMARY KEY,
    started TIMESTAMPTZ NOT NULL,
    email TEXT,
    version TEXT,
    last_activity TIMESTAMPTZ,
    total_time_spent_ms BIGINT DEFAULT 0,
    slide_time_ms JSONB DEFAULT '{}'::jsonb,
    slides_viewed INT[] DEFAULT '{}',
    last_slide INT DEFAULT 1,
    email_submitted_at TIMESTAMPTZ
);

-- Note: Because this uses an anonymous key to UPSERT data from the client,
-- you may want to either disable RLS or add policies allowing inserts and updates to everyone.
-- For a quick setup without RLS (make sure you don't store sensitive data):
ALTER TABLE deck_sessions DISABLE ROW LEVEL SECURITY;
