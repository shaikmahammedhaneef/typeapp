import { NextResponse } from 'next/server';
import { getCurrentCompetition } from '@/lib/competitions';
import { sql } from '@/lib/db';
import { error, readJson } from '@/lib/http';
import { getPlayer, newPlayerToken, setPlayerCookie, validateUsername } from '@/lib/player';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  if (!rateLimit(`join:${clientIp(req)}`, 30, 60_000)) {
    return error('Too many attempts. Please wait a minute.', 429);
  }
  const body = await readJson<{ username: string }>(req);
  const c = await getCurrentCompetition();
  if (!c) return error('No competition is open right now. Please wait for the admin.', 404);

  const existing = await getPlayer(c.id);
  if (existing) {
    return NextResponse.json({ competitionId: c.id, username: existing.username });
  }
  if (c.status !== 'open') {
    return error('This competition has already started. Please wait for the next one.', 409);
  }

  const username = validateUsername(body.username);
  if (typeof username !== 'string') return error(username.error, 400);

  const { token, hash } = newPlayerToken();
  const rows = await sql`
    INSERT INTO participants (competition_id, username, token_hash)
    SELECT ${c.id}, ${username}, ${hash}
    WHERE EXISTS (SELECT 1 FROM competitions WHERE id = ${c.id} AND status = 'open')
    ON CONFLICT DO NOTHING
    RETURNING id`;
  if (!rows.length) {
    const fresh = await getCurrentCompetition();
    if (!fresh || fresh.id !== c.id || fresh.status !== 'open') {
      return error('This competition has already started. Please wait for the next one.', 409);
    }
    return error('That username is already taken in this competition.', 409);
  }

  const res = NextResponse.json({ competitionId: c.id, username });
  setPlayerCookie(res, c.id, rows[0].id, token);
  return res;
}
