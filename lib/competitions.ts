import 'server-only';
import { ensureSchema, sql } from './db';
import { scoreTyping } from './scoring';

/** Seconds between the admin pressing Start and typing unlocking, so every player's poll sees it in time. */
export const LEAD_IN_SEC = 5;
/** Seconds after the deadline during which submissions are still accepted (network latency). */
export const GRACE_SEC = 5;

export type Status = 'draft' | 'open' | 'running' | 'finished';

export interface Competition {
  id: number;
  title: string;
  passage: string;
  durationSec: number;
  status: Status;
  startedAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  /** Database clock at query time; all timing decisions use it, never the app server clock. */
  dbNow: Date;
}

type Row = Record<string, any>;

function toCompetition(r: Row): Competition {
  return {
    id: r.id,
    title: r.title,
    passage: r.passage,
    durationSec: r.duration_sec,
    status: r.status,
    startedAt: r.started_at ? new Date(r.started_at) : null,
    endsAt: r.ends_at ? new Date(r.ends_at) : null,
    createdAt: new Date(r.created_at),
    dbNow: new Date(r.db_now),
  };
}

export function publicCompetition(c: Competition) {
  return {
    id: c.id,
    title: c.title,
    durationSec: c.durationSec,
    status: c.status,
    startedAt: c.startedAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    serverNow: c.dbNow.toISOString(),
  };
}

function isPastGrace(c: Competition): boolean {
  return (
    c.status === 'running' &&
    c.endsAt !== null &&
    c.dbNow.getTime() > c.endsAt.getTime() + GRACE_SEC * 1000
  );
}

/** Loads a competition, lazily moving it to 'finished' once the deadline + grace has passed. */
export async function getCompetition(id: number): Promise<Competition | null> {
  await ensureSchema();
  const rows = await sql`SELECT *, now() AS db_now FROM competitions WHERE id = ${id}`;
  if (!rows.length) return null;
  const c = toCompetition(rows[0]);
  if (isPastGrace(c)) {
    await finalizeCompetition(c.id);
    return { ...c, status: 'finished' };
  }
  return c;
}

/** The competition players can currently join (or are racing in), if any. */
export async function getCurrentCompetition(): Promise<Competition | null> {
  await ensureSchema();
  const rows = await sql`
    SELECT id FROM competitions
    WHERE status IN ('open', 'running')
    ORDER BY (status = 'open') DESC, created_at DESC
    LIMIT 1`;
  if (!rows.length) return null;
  const c = await getCompetition(rows[0].id);
  return c && (c.status === 'open' || c.status === 'running') ? c : null;
}

export async function listCompetitions() {
  await ensureSchema();
  const running = await sql`
    SELECT id FROM competitions WHERE status = 'running' AND ends_at + ${GRACE_SEC} * interval '1 second' < now()`;
  for (const r of running) await finalizeCompetition(r.id);
  return sql`
    SELECT c.id, c.title, c.status, c.duration_sec, c.started_at, c.ends_at, c.created_at,
      (SELECT count(*)::int FROM participants p WHERE p.competition_id = c.id) AS player_count,
      (SELECT count(*)::int FROM results r WHERE r.competition_id = c.id) AS result_count
    FROM competitions c
    ORDER BY c.created_at DESC`;
}

/**
 * Marks a competition finished and records a result for every player who typed something
 * but never submitted (e.g. closed the tab), using their last live progress.
 */
export async function finalizeCompetition(id: number): Promise<void> {
  const rows = await sql`
    UPDATE competitions SET status = 'finished'
    WHERE id = ${id} AND status IN ('running', 'finished')
    RETURNING passage, started_at, ends_at`;
  if (!rows.length) return;
  const { passage, started_at, ends_at } = rows[0];
  const elapsedSec = Math.max(
    0,
    (new Date(ends_at).getTime() - new Date(started_at).getTime()) / 1000,
  );
  const missing = await sql`
    SELECT lp.participant_id, lp.typed_text
    FROM live_progress lp
    LEFT JOIN results r ON r.participant_id = lp.participant_id
    WHERE lp.competition_id = ${id} AND r.id IS NULL`;
  for (const m of missing) {
    const s = scoreTyping(passage, m.typed_text, elapsedSec);
    await sql`
      INSERT INTO results (participant_id, competition_id, typed_text, typed_chars, correct_chars,
        errors, wpm, raw_wpm, accuracy, elapsed_sec, source)
      VALUES (${m.participant_id}, ${id}, ${m.typed_text}, ${s.typedChars}, ${s.correctChars},
        ${s.errors}, ${s.wpm}, ${s.rawWpm}, ${s.accuracy}, ${elapsedSec}, 'server')
      ON CONFLICT (participant_id) DO NOTHING`;
  }
}

/** Seconds of typing time used so far, clamped to the race window. */
export function elapsedSeconds(c: Competition): number {
  if (!c.startedAt || !c.endsAt) return 0;
  const end = Math.min(c.dbNow.getTime(), c.endsAt.getTime());
  return Math.max(0, (end - c.startedAt.getTime()) / 1000);
}

/** Whether a player may send progress / submit right now. */
export function acceptingInput(c: Competition): boolean {
  if (!c.startedAt || !c.endsAt) return false;
  if (c.status !== 'running' && c.status !== 'finished') return false;
  const now = c.dbNow.getTime();
  return now >= c.startedAt.getTime() && now <= c.endsAt.getTime() + GRACE_SEC * 1000;
}

export async function getLeaderboard(competitionId: number) {
  const rows = await sql`
    SELECT p.username, r.wpm, r.accuracy, r.errors, r.correct_chars
    FROM results r JOIN participants p ON p.id = r.participant_id
    WHERE r.competition_id = ${competitionId}
    ORDER BY r.wpm DESC, r.accuracy DESC, r.submitted_at ASC`;
  return rows.map((r, i) => ({
    rank: i + 1,
    username: r.username as string,
    wpm: r.wpm as number,
    accuracy: r.accuracy as number,
    errors: r.errors as number,
  }));
}
