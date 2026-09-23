'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

/**
 * Tracks the offset between this browser's clock and the database clock, so countdowns are
 * based on server time. Feed it `serverNow` from any API response plus when the request started.
 */
export function useServerClock() {
  const offset = useRef(0);
  const best = useRef(Infinity);
  const sync = useCallback((serverNowIso: string, sentAt: number) => {
    const receivedAt = Date.now();
    const rtt = receivedAt - sentAt;
    // Prefer samples with the lowest round-trip time; they are the most accurate.
    if (rtt <= best.current * 1.5) {
      best.current = Math.min(best.current, rtt);
      offset.current = new Date(serverNowIso).getTime() - (sentAt + rtt / 2);
    }
  }, []);
  const now = useCallback(() => Date.now() + offset.current, []);
  // Stable identity so callers can list it in effect dependencies.
  return useMemo(() => ({ sync, now }), [sync, now]);
}

/** Re-renders every `ms` milliseconds. */
export function useTick(ms: number, enabled = true) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
}

export function formatSeconds(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
