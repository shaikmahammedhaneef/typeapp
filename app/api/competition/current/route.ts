import { getCurrentCompetition, publicCompetition } from '@/lib/competitions';
import { sql } from '@/lib/db';
import { json } from '@/lib/http';
import { getPlayer } from '@/lib/player';

export const dynamic = 'force-dynamic';

export async function GET() {
  const c = await getCurrentCompetition();
  if (!c) return json({ competition: null });
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM participants WHERE competition_id = ${c.id}`;
  const player = await getPlayer(c.id);
  return json({
    competition: { ...publicCompetition(c), playerCount: count },
    joinedAs: player?.username ?? null,
  });
}
