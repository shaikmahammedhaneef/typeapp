// Idempotent schema. Each entry is run as its own statement (the Neon HTTP
// driver does not accept multi-statement queries).
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    passage TEXT NOT NULL,
    duration_sec INTEGER NOT NULL DEFAULT 60 CHECK (duration_sec BETWEEN 10 AND 3600),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'running', 'finished')),
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS participants_competition_username
    ON participants (competition_id, lower(username))`,
  `CREATE TABLE IF NOT EXISTS live_progress (
    participant_id INTEGER PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    typed_text TEXT NOT NULL DEFAULT '',
    typed_chars INTEGER NOT NULL DEFAULT 0,
    correct_chars INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    wpm REAL NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0,
    progress_pct REAL NOT NULL DEFAULT 0,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS live_progress_competition ON live_progress (competition_id)`,
  `CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    typed_text TEXT NOT NULL,
    typed_chars INTEGER NOT NULL,
    correct_chars INTEGER NOT NULL,
    errors INTEGER NOT NULL,
    wpm REAL NOT NULL,
    raw_wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    elapsed_sec REAL NOT NULL,
    -- 'manual' (player clicked submit / finished passage), 'timer' (client auto-submit
    -- at time up), 'server' (backfilled from last live progress when the player never submitted)
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'timer', 'server')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS results_competition ON results (competition_id)`,
];
