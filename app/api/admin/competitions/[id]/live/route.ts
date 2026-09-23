import { getCompetition, publicCompetition } from '@/lib/competitions';
import { error, isAdmin, json, parseId } from '@/lib/http';
import { getParticipantStats } from '@/lib/liveStats';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const id = parseId((await params).id);
  const c = id && (await getCompetition(id));
  if (!c) return error('Competition not found', 404);
  return json({
    competition: { ...publicCompetition(c), passageLength: c.passage.length },
    participants: await getParticipantStats(c.id),
  });
}
