'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import Sparkline from '@/components/Sparkline';
import { api, formatSeconds, useServerClock, useTick } from '@/components/client';

interface Participant {
  username: string;
  joinedAt: string;
  live: {
    wpm: number;
    accuracy: number;
    progressPct: number;
    errors: number;
    history: { t: number; wpm: number }[];
    updatedAt: string;
  } | null;
  result: {
    wpm: number;
    rawWpm: number;
    accuracy: number;
    errors: number;
    elapsedSec: number;
    source: string;
    submittedAt: string;
  } | null;
}
interface Live {
  competition: {
    id: number;
    title: string;
    status: 'draft' | 'open' | 'running' | 'finished';
    durationSec: number;
    startedAt: string | null;
    endsAt: string | null;
    serverNow: string;
    passageLength: number;
  };
  participants: Participant[];
}

const LIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 5000;

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Submitted',
  timer: 'Auto (time up)',
  server: 'Auto (disconnected)',
};

export default function StatsPage() {
  const { id } = useParams<{ id: string }>();
  const clock = useServerClock();
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const sentAt = Date.now();
    try {
      const d = await api<Live>(`/api/admin/competitions/${id}/live`);
      clock.sync(d.competition.serverNow, sentAt);
      setData(d);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, clock]);

  const status = data?.competition.status;
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (status === 'finished') return;
    const t = setInterval(load, status === 'running' ? LIVE_POLL_MS : IDLE_POLL_MS);
    return () => clearInterval(t);
  }, [status, load]);
  useTick(500, status === 'running');

  if (!data) {
    return (
      <main className="container">
        <AdminNav />
        <p className="muted">{error || 'Loading…'}</p>
      </main>
    );
  }

  const c = data.competition;
  const now = clock.now();
  const running = c.status === 'running';
  const finished = c.status === 'finished';

  const rows = data.participants
    .map((p) => {
      const final = p.result;
      const wpm = final?.wpm ?? p.live?.wpm ?? 0;
      const accuracy = final?.accuracy ?? p.live?.accuracy ?? null;
      const errors = final?.errors ?? p.live?.errors ?? null;
      const progress = p.live?.progressPct ?? 0;
      const sinceUpdate = p.live ? (now - new Date(p.live.updatedAt).getTime()) / 1000 : Infinity;
      let state: { label: string; cls: string };
      if (final) state = { label: SOURCE_LABEL[final.source] ?? 'Done', cls: 'done' };
      else if (!running) state = { label: finished ? 'No submission' : 'Joined', cls: 'waiting' };
      else if (!p.live) state = { label: 'Not started', cls: 'waiting' };
      else if (sinceUpdate < 5) state = { label: 'Typing', cls: 'typing' };
      else if (sinceUpdate < 15) state = { label: 'Idle', cls: 'idle' };
      else state = { label: 'Disconnected', cls: 'offline' };
      return { ...p, wpm, accuracy, errors, progress, state };
    })
    .sort((a, b) => b.wpm - a.wpm || (b.accuracy ?? 0) - (a.accuracy ?? 0));

  const scored = rows.filter((r) => r.result || r.live);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
  const remaining = c.endsAt ? (new Date(c.endsAt).getTime() - now) / 1000 : c.durationSec;
  const beforeStart = c.startedAt ? now < new Date(c.startedAt).getTime() : false;

  return (
    <main className="container">
      <AdminNav crumbs={[{ href: `/admin/competitions/${id}`, label: c.title }, { label: 'Stats' }]} />
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row">
          <h1 style={{ margin: 0 }}>{c.title}</h1>
          <span className={`badge ${c.status}`}>{c.status}</span>
          {running && (
            <span className="muted">
              <span className="pulse" />
              {beforeStart ? 'Starting…' : 'Live'}
            </span>
          )}
        </div>
        <div className="row">
          <Link className="btn secondary" href={`/admin/competitions/${id}`}>Manage</Link>
          <a className="btn secondary" href={`/api/admin/competitions/${id}/export`}>Export CSV</a>
        </div>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="stats" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <Stat label={running ? 'Time left' : 'Duration'} value={running ? formatSeconds(remaining) : `${c.durationSec}s`} />
        <Stat label="Players" value={rows.length} />
        <Stat label="Submitted" value={`${rows.filter((r) => r.result).length}/${rows.length}`} />
        <Stat label={finished ? 'Top WPM' : 'Top WPM (live)'} value={scored.length ? Math.max(...scored.map((r) => r.wpm)) : '—'} />
        <Stat label="Avg WPM" value={scored.length ? avg(scored.map((r) => r.wpm)) : '—'} />
        <Stat label="Avg accuracy" value={scored.length ? `${avg(scored.map((r) => r.accuracy ?? 0))}%` : '—'} />
      </div>

      <div className="card">
        <h2>{finished ? 'Final leaderboard' : running ? 'Live leaderboard' : 'Players'}</h2>
        {rows.length === 0 ? (
          <p className="muted">No players have joined this competition.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Status</th>
                <th className="num">WPM</th>
                <th className="num">Accuracy</th>
                <th className="num">Errors</th>
                <th>Progress</th>
                <th>WPM over time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.username}>
                  <td>{r.result || r.live ? i + 1 : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r.username}</td>
                  <td><span className={`badge ${r.state.cls}`}>{r.state.label}</span></td>
                  <td className="num" style={{ fontSize: 18, fontWeight: 700 }}>{r.result || r.live ? r.wpm : '—'}</td>
                  <td className="num">{r.accuracy !== null ? `${r.accuracy}%` : '—'}</td>
                  <td className="num">{r.errors ?? '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="progress" style={{ flex: 1 }}>
                        <div style={{ width: `${Math.min(100, r.progress)}%` }} />
                      </div>
                      <span className="muted" style={{ fontSize: 12, width: 38 }}>{Math.round(r.progress)}%</span>
                    </div>
                  </td>
                  <td><Sparkline points={r.live?.history ?? []} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
