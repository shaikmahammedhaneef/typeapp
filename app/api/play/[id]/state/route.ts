import { getCompetition, getLeaderboard, publicCompetition } from '@/lib/competitions';
import { sql } from '@/lib/db';
import { error, json, parseId } from '@/lib/http';
import { getPlayer } from '@/lib/player';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return error('Not found', 404);
  const c = await getCompetition(id);
  if (!c) return error('Competition not found', 404);
  const player = await getPlayer(id);
  if (!player) return error('You have not joined this competition.', 401);

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM participants WHERE competition_id = ${id}`;
  const resultRows = await sql`
    SELECT wpm, raw_wpm, accuracy, errors, correct_chars, typed_chars, elapsed_sec, source
    FROM results WHERE participant_id = ${player.id}`;
  const r = resultRows[0];

  return json({
    competition: {
      ...publicCompetition(c),
      // Sent as soon as the race is scheduled; the client keeps it hidden until startedAt.
      passage: c.status === 'running' || c.status === 'finished' ? c.passage : null,
    },
    playerCount: count,
    me: { username: player.username },
    result: r
      ? {
          wpm: r.wpm,
          rawWpm: r.raw_wpm,
          accuracy: r.accuracy,
          errors: r.errors,
          correctChars: r.correct_chars,
          typedChars: r.typed_chars,
          elapsedSec: r.elapsed_sec,
          source: r.source,
        }
      : null,
    leaderboard: c.status === 'finished' ? await getLeaderboard(id) : null,
  });
}
