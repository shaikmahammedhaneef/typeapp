import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS, createAdminToken } from '@/lib/auth';
import { error, readJson } from '@/lib/http';
import { clearRateLimit, clientIp, rateLimit } from '@/lib/rateLimit';

const digest = (s: string) => createHash('sha256').update(s).digest();

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return error('Admin login is not configured (ADMIN_PASSWORD is not set).', 500);

  const key = `login:${clientIp(req)}`;
  if (!rateLimit(key, 5, 15 * 60_000)) {
    return error('Too many login attempts. Try again in 15 minutes.', 429);
  }

  const { password } = await readJson<{ password: string }>(req);
  // Compare fixed-length digests so the comparison is constant-time regardless of input length.
  const ok =
    typeof password === 'string' && timingSafeEqual(digest(password), digest(expected));
  if (!ok) return error('Incorrect password.', 401);

  clearRateLimit(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createAdminToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_HOURS * 60 * 60,
  });
  return res;
}
