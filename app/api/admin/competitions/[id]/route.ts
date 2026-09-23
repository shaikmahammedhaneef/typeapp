import { getCompetition, publicCompetition } from '@/lib/competitions';
import { sql } from '@/lib/db';
import { error, isAdmin, json, parseId, readJson } from '@/lib/http';
import { validateCompetitionInput } from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const id = parseId((await params).id);
  const c = id && (await getCompetition(id));
  if (!c) return error('Competition not found', 404);
  const players = await sql`
    SELECT username, joined_at FROM participants WHERE competition_id = ${c.id} ORDER BY joined_at`;
  return json({
    competition: { ...publicCompetition(c), passage: c.passage },
    players: players.map((p) => ({ username: p.username, joinedAt: p.joined_at })),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const id = parseId((await params).id);
  if (!id) return error('Competition not found', 404);
  const input = validateCompetitionInput(await readJson(req));
  if (typeof input === 'string') return error(input, 400);
  const rows = await sql`
    UPDATE competitions
    SET title = ${input.title}, passage = ${input.passage}, duration_sec = ${input.durationSec}
    WHERE id = ${id} AND status IN ('draft', 'open')
    RETURNING id`;
  if (!rows.length) {
    return error('Only competitions that have not started yet can be edited.', 409);
  }
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const id = parseId((await params).id);
  if (!id) return error('Competition not found', 404);
  const rows = await sql`
    DELETE FROM competitions WHERE id = ${id} AND status <> 'running' RETURNING id`;
  if (!rows.length) return error('A running competition cannot be deleted. End it first.', 409);
  return json({ ok: true });
}
