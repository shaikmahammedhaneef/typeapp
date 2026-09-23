import 'server-only';
import { sql } from './db';

export async function getParticipantStats(competitionId: number) {
  const rows = await sql`
    SELECT p.id, p.username, p.joined_at,
      lp.wpm AS live_wpm, lp.accuracy AS live_accuracy, lp.progress_pct, lp.errors AS live_errors,
      lp.history, lp.updated_at,
      r.wpm, r.raw_wpm, r.accuracy, r.errors, r.correct_chars, r.typed_chars, r.elapsed_sec,
      r.source, r.submitted_at
    FROM participants p
    LEFT JOIN live_progress lp ON lp.participant_id = p.id
    LEFT JOIN results r ON r.participant_id = p.id
    WHERE p.competition_id = ${competitionId}
    ORDER BY p.joined_at`;
  return rows.map((r) => ({
    username: r.username as string,
    joinedAt: r.joined_at,
    live: r.updated_at
      ? {
          wpm: r.live_wpm as number,
          accuracy: r.live_accuracy as number,
          progressPct: r.progress_pct as number,
          errors: r.live_errors as number,
          history: (r.history ?? []) as { t: number; wpm: number }[],
          updatedAt: r.updated_at,
        }
      : null,
    result: r.submitted_at
      ? {
          wpm: r.wpm as number,
          rawWpm: r.raw_wpm as number,
          accuracy: r.accuracy as number,
          errors: r.errors as number,
          correctChars: r.correct_chars as number,
          typedChars: r.typed_chars as number,
          elapsedSec: r.elapsed_sec as number,
          source: r.source as string,
          submittedAt: r.submitted_at,
        }
      : null,
  }));
}
