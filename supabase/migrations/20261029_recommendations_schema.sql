-- ============================================================
-- ListenUp Recommendations Schema
-- Migration: 20261029_recommendations_schema.sql
-- Adds: listening_events, user_song_stats tables with RLS
-- Safe: uses IF NOT EXISTS / IF NOT EXISTS — idempotent
-- ============================================================

-- ─── 11. Listening Events Log ────────────────────────────────
-- Raw event log for every meaningful playback interaction.
-- Kept lean: only data needed for scoring is recorded.
-- Progress heartbeats are batched — not one row per tick.
CREATE TABLE IF NOT EXISTS public.listening_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- NULL user_id is allowed for anonymous/guest sessions (ignored in scoring)
  song_id       TEXT        NOT NULL,
  song_data     JSONB       NOT NULL DEFAULT '{}',
  -- event_type: 'play_started' | 'play_completed' | 'song_skipped'
  --             | 'song_liked' | 'song_unliked' | 'playlist_added'
  --             | 'play_progress'
  event_type    TEXT        NOT NULL,
  -- How many seconds were actually listened to before this event fired.
  -- NULL for 'play_started', 'song_liked', etc.
  listen_seconds FLOAT      DEFAULT NULL,
  -- Fraction 0.0–1.0: listen_seconds / song_duration at time of event.
  -- Used to distinguish genuine completion vs. early skip.
  listen_fraction FLOAT     DEFAULT NULL,
  -- Free-form metadata: session_id, platform, skip_reason, etc.
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.listening_events IS
  'Raw listening event log. Used by the recommendation engine to score songs.';
COMMENT ON COLUMN public.listening_events.listen_fraction IS
  'Fraction of song listened (0.0–1.0). <0.2 = early skip. >0.8 = near-complete.';

-- ─── 12. User Song Stats (Aggregated) ───────────────────────
-- Materialized per-user per-song stats, updated by the backend
-- when events arrive. Kept in sync via UPSERT. Avoids expensive
-- GROUP BY queries on the raw events table every recommendation call.
CREATE TABLE IF NOT EXISTS public.user_song_stats (
  user_id               UUID    REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id               TEXT    NOT NULL,
  song_data             JSONB   NOT NULL DEFAULT '{}',
  -- Aggregate counters
  play_count            INT     NOT NULL DEFAULT 0,
  skip_count            INT     NOT NULL DEFAULT 0,
  complete_count        INT     NOT NULL DEFAULT 0,
  total_listen_seconds  FLOAT   NOT NULL DEFAULT 0,
  -- Derived signals
  is_liked              BOOLEAN NOT NULL DEFAULT false,
  playlist_add_count    INT     NOT NULL DEFAULT 0,
  -- Recency
  first_played_at       TIMESTAMPTZ DEFAULT NOW(),
  last_played_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

COMMENT ON TABLE public.user_song_stats IS
  'Per-user per-song aggregated stats. Updated on every listening event. Drives recommendation scoring.';

-- ─── Indexes ─────────────────────────────────────────────────
-- Events: filter by user + recency for history queries
CREATE INDEX IF NOT EXISTS idx_listening_events_user_created
  ON public.listening_events(user_id, created_at DESC);

-- Events: filter by user + song for duplicate detection
CREATE INDEX IF NOT EXISTS idx_listening_events_user_song
  ON public.listening_events(user_id, song_id);

-- Events: filter by event_type for analytics
CREATE INDEX IF NOT EXISTS idx_listening_events_type
  ON public.listening_events(event_type);

-- Stats: filter by user, ordered by last played (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_song_stats_user_last_played
  ON public.user_song_stats(user_id, last_played_at DESC);

-- Stats: find liked songs quickly
CREATE INDEX IF NOT EXISTS idx_user_song_stats_liked
  ON public.user_song_stats(user_id, is_liked)
  WHERE is_liked = true;

-- Stats: find most-played songs
CREATE INDEX IF NOT EXISTS idx_user_song_stats_play_count
  ON public.user_song_stats(user_id, play_count DESC);

-- ─── Row-Level Security ───────────────────────────────────────
ALTER TABLE public.listening_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_song_stats  ENABLE ROW LEVEL SECURITY;

-- Listening events: users see only their own rows
DROP POLICY IF EXISTS "Users manage own listening events"
  ON public.listening_events;
CREATE POLICY "Users manage own listening events"
  ON public.listening_events FOR ALL
  USING (auth.uid() = user_id);

-- Allow anonymous inserts (guest listeners) with NULL user_id —
-- these rows are harmless (no PII) and let the backend still receive events.
DROP POLICY IF EXISTS "Anonymous events allowed"
  ON public.listening_events;
CREATE POLICY "Anonymous events allowed"
  ON public.listening_events FOR INSERT
  WITH CHECK (user_id IS NULL);

-- User song stats: users manage only their own rows
DROP POLICY IF EXISTS "Users manage own song stats"
  ON public.user_song_stats;
CREATE POLICY "Users manage own song stats"
  ON public.user_song_stats FOR ALL
  USING (auth.uid() = user_id);

-- ─── Helper: updated_at trigger for user_song_stats ─────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_song_stats_updated_at ON public.user_song_stats;
CREATE TRIGGER set_user_song_stats_updated_at
  BEFORE UPDATE ON public.user_song_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

