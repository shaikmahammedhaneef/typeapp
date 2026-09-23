import { listCompetitions } from '@/lib/competitions';
import { ensureSchema, sql } from '@/lib/db';
import { error, isAdmin, json, readJson } from '@/lib/http';
import { validateCompetitionInput } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const rows = await listCompetitions();
  return json({
    competitions: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      durationSec: r.duration_sec,
      startedAt: r.started_at,
      createdAt: r.created_at,
      playerCount: r.player_count,
      resultCount: r.result_count,
    })),
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const input = validateCompetitionInput(await readJson(req));
  if (typeof input === 'string') return error(input, 400);
  await ensureSchema();
  const rows = await sql`
    INSERT INTO competitions (title, passage, duration_sec)
    VALUES (${input.title}, ${input.passage}, ${input.durationSec})
    RETURNING id`;
  return json({ id: rows[0].id }, 201);
}
