import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { sql } from './db';

const cookieName = (competitionId: number) => `tp_${competitionId}`;

export function newPlayerToken() {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function setPlayerCookie(
  res: NextResponse,
  competitionId: number,
  participantId: number,
  token: string,
) {
  res.cookies.set(cookieName(competitionId), `${participantId}.${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export interface Player {
  id: number;
  username: string;
}

/** Identifies the player for a competition from their HttpOnly cookie. */
export async function getPlayer(competitionId: number): Promise<Player | null> {
  const store = await cookies();
  const value = store.get(cookieName(competitionId))?.value;
  if (!value) return null;
  const dot = value.indexOf('.');
  const participantId = Number(value.slice(0, dot));
  const token = value.slice(dot + 1);
  if (dot < 1 || !Number.isInteger(participantId) || !token) return null;

  const rows = await sql`
    SELECT id, username, token_hash FROM participants
    WHERE id = ${participantId} AND competition_id = ${competitionId}`;
  if (!rows.length) return null;
  const expected = Buffer.from(rows[0].token_hash, 'hex');
  const actual = Buffer.from(hashToken(token), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { id: rows[0].id, username: rows[0].username };
}

const USERNAME_RE = /^[A-Za-z0-9 _.-]+$/;

export function validateUsername(raw: unknown): string | { error: string } {
  const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 20) {
    return { error: 'Username must be 2–20 characters.' };
  }
  if (!USERNAME_RE.test(name)) {
    return { error: 'Use letters, numbers, spaces, dots, dashes or underscores only.' };
  }
  return name;
}
