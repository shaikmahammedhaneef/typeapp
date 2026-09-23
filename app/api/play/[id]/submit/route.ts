import { acceptingInput, elapsedSeconds, getCompetition } from '@/lib/competitions';
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
  if (!acceptingInput(c)) return error('Submissions are closed for this competition.', 409);

  const body = await readJson<{ typed: string; source: string }>(req);
  const typed = normalizeText(typeof body.typed === 'string' ? body.typed : '').slice(
    0,
    c.passage.length,
  );
  const source = body.source === 'timer' ? 'timer' : 'manual';
  const elapsed = elapsedSeconds(c);
  const s = scoreTyping(c.passage, typed, elapsed);

  // One submission per player; it may only replace a result the server backfilled.
  const rows = await sql`
    INSERT INTO results (participant_id, competition_id, typed_text, typed_chars, correct_chars,
      errors, wpm, raw_wpm, accuracy, elapsed_sec, source)
    VALUES (${player.id}, ${id}, ${typed}, ${s.typedChars}, ${s.correctChars}, ${s.errors},
      ${s.wpm}, ${s.rawWpm}, ${s.accuracy}, ${elapsed}, ${source})
    ON CONFLICT (participant_id) DO UPDATE SET
      typed_text = EXCLUDED.typed_text,
      typed_chars = EXCLUDED.typed_chars,
      correct_chars = EXCLUDED.correct_chars,
      errors = EXCLUDED.errors,
      wpm = EXCLUDED.wpm,
      raw_wpm = EXCLUDED.raw_wpm,
      accuracy = EXCLUDED.accuracy,
      elapsed_sec = EXCLUDED.elapsed_sec,
      source = EXCLUDED.source,
      submitted_at = now()
    WHERE results.source = 'server'
    RETURNING id`;
  if (!rows.length) return error('You have already submitted.', 409);

  await sql`
    UPDATE live_progress SET typed_text = ${typed}, typed_chars = ${s.typedChars},
      correct_chars = ${s.correctChars}, errors = ${s.errors}, wpm = ${s.wpm},
      accuracy = ${s.accuracy}, progress_pct = ${s.progressPct}, updated_at = now()
    WHERE participant_id = ${player.id}`;

  return json({ result: { ...s, elapsedSec: elapsed, source } });
}
