import { finalizeCompetition, getCompetition, LEAD_IN_SEC } from '@/lib/competitions';
import { sql } from '@/lib/db';
import { error, isAdmin, json, parseId, readJson } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const id = parseId((await params).id);
  const c = id && (await getCompetition(id));
  if (!c) return error('Competition not found', 404);
  const { action } = await readJson<{ action: string }>(req);

  switch (action) {
    case 'open': {
      if (c.status !== 'draft') return error('Only draft competitions can be opened.', 409);
      const running = await sql`SELECT id FROM competitions WHERE status = 'running' AND id <> ${c.id}`;
      if (running.length) {
        return error(`Competition #${running[0].id} is still running. End it first.`, 409);
      }
      // Only one competition is open for joining at a time.
      await sql`UPDATE competitions SET status = 'draft' WHERE status = 'open' AND id <> ${c.id}`;
      await sql`UPDATE competitions SET status = 'open' WHERE id = ${c.id} AND status = 'draft'`;
      break;
    }
    case 'close': {
      await sql`UPDATE competitions SET status = 'draft' WHERE id = ${c.id} AND status = 'open'`;
      break;
    }
    case 'start': {
      const rows = await sql`
        UPDATE competitions
        SET status = 'running',
          started_at = now() + ${LEAD_IN_SEC} * interval '1 second',
          ends_at = now() + (${LEAD_IN_SEC} + duration_sec) * interval '1 second'
        WHERE id = ${c.id} AND status = 'open'
        RETURNING id`;
      if (!rows.length) return error('Open the competition for joining before starting it.', 409);
      break;
    }
    case 'end': {
      const rows = await sql`
        UPDATE competitions
        SET status = 'finished', ends_at = LEAST(ends_at, now()),
          started_at = LEAST(started_at, now())
        WHERE id = ${c.id} AND status = 'running'
        RETURNING id`;
      if (!rows.length) return error('Only a running competition can be ended.', 409);
      await finalizeCompetition(c.id);
      break;
    }
    default:
      return error('Unknown action', 400);
  }
  return json({ ok: true });
}
