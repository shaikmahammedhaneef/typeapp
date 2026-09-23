import {
  acceptingInput,
  elapsedSeconds,
  getCompetition,
  publicCompetition,
} from '@/lib/competitions';
import { sql } from '@/lib/db';
import { error, json, parseId, readJson } from '@/lib/http';
import { getPlayer } from '@/lib/player';
import { normalizeText, scoreTyping } from '@/lib/scoring';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return error('Not found', 404);
  const c = await getCompetition(id);
  if (!c) return error('Competition not found', 404);
  const player = await getPlayer(id);
  if (!player) return error('You have not joined this competition.', 401);

  const status = publicCompetition(c);
  if (!acceptingInput(c) || c.status !== 'running') return json({ competition: status });

  const body = await readJson<{ typed: string }>(req);
  const typed = normalizeText(typeof body.typed === 'string' ? body.typed : '').slice(
    0,
    c.passage.length,
  );
  const elapsed = elapsedSeconds(c);
  const s = scoreTyping(c.passage, typed, elapsed);
  const sample = JSON.stringify([{ t: Math.round(elapsed), wpm: s.wpm }]);

  // Skipped once the player has a result, so a late heartbeat can't overwrite final numbers.
  await sql`
    INSERT INTO live_progress (participant_id, competition_id, typed_text, typed_chars,
      correct_chars, errors, wpm, accuracy, progress_pct, history, updated_at)
    SELECT ${player.id}, ${id}, ${typed}, ${s.typedChars}, ${s.correctChars}, ${s.errors},
      ${s.wpm}, ${s.accuracy}, ${s.progressPct}, ${sample}::jsonb, now()
    WHERE NOT EXISTS (SELECT 1 FROM results WHERE participant_id = ${player.id})
    ON CONFLICT (participant_id) DO UPDATE SET
      typed_text = EXCLUDED.typed_text,
      typed_chars = EXCLUDED.typed_chars,
      correct_chars = EXCLUDED.correct_chars,
      errors = EXCLUDED.errors,
      wpm = EXCLUDED.wpm,
      accuracy = EXCLUDED.accuracy,
      progress_pct = EXCLUDED.progress_pct,
      history = live_progress.history || EXCLUDED.history,
      updated_at = now()`;

  return json({ competition: status, live: s });
}
