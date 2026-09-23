'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import Avatar from '@/components/Avatar';
import Podium from '@/components/Podium';
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
    // Same ordering as the players' leaderboard: WPM, then accuracy, then earliest submission.
    .sort(
      (a, b) =>
        b.wpm - a.wpm ||
        (b.accuracy ?? 0) - (a.accuracy ?? 0) ||
        submittedMs(a.result) - submittedMs(b.result),
    );

  const scored = rows.filter((r) => r.result || r.live);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
  const remaining = c.endsAt ? (new Date(c.endsAt).getTime() - now) / 1000 : c.durationSec;
  const beforeStart = c.startedAt ? now < new Date(c.startedAt).getTime() : false;
  const submitted = rows.filter((r) => r.result).length;
  const ranked = rows.filter((r) => r.result);

  return (
    <main className="container">
      <AdminNav crumbs={[{ href: `/admin/competitions/${id}`, label: c.title }, { label: 'Stats' }]} />
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row">
          <h1 style={{ margin: 0 }}>{c.title}</h1>
          <span className={`badge ${c.status}`}>{c.status}</span>
          {running && (
            <span className="muted" style={{ fontWeight: 600 }}>
              <span className="pulse" />
              {beforeStart ? `Starting in ${Math.ceil((new Date(c.startedAt!).getTime() - now) / 1000)}…` : 'Live'}
            </span>
          )}
        </div>
        <div className="row">
          <Link className="btn secondary" href={`/admin/competitions/${id}`}>⚙️ Manage</Link>
          <a className="btn secondary" href={`/api/admin/competitions/${id}/export`}>⬇️ Export CSV</a>
        </div>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="stats" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <Stat
          icon="⏱️"
          label={running ? 'Time left' : 'Duration'}
          value={running ? formatSeconds(beforeStart ? c.durationSec : remaining) : `${c.durationSec}s`}
          danger={running && !beforeStart && remaining <= 10}
        />
        <Stat icon="👥" label="Players" value={rows.length} />
        <Stat icon="✅" label="Submitted" value={`${submitted}/${rows.length}`} />
        <Stat icon="⚡" label="Top WPM" value={scored.length ? Math.max(...scored.map((r) => r.wpm)) : '—'} />
        <Stat icon="📈" label="Avg WPM" value={scored.length ? avg(scored.map((r) => r.wpm)) : '—'} />
        <Stat icon="🎯" label="Avg accuracy" value={scored.length ? `${avg(scored.map((r) => r.accuracy ?? 0))}%` : '—'} />
      </div>

      {finished ? (
        <>
          {ranked.length > 0 ? (
            <Podium
              title="Winners"
              subtitle={`${ranked.length} player${ranked.length === 1 ? '' : 's'} finished · ${c.durationSec}s race`}
              top={ranked.slice(0, 3).map((r) => ({ username: r.username, wpm: r.wpm, accuracy: r.accuracy }))}
            />
          ) : (
            <div className="card empty-state">
              <div className="big-emoji">🤷</div>
              <p className="muted">Nobody typed anything in this competition.</p>
            </div>
          )}
          <div className="card">
            <h2>📋 Full results</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Player</th>
                  <th className="num">WPM</th>
                  <th className="num">Accuracy</th>
                  <th className="num">Errors</th>
                  <th>Progress</th>
                  <th>Submission</th>
                  <th>Speed over time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.username}>
                    <td className="medal-rank">{r.result ? MEDALS[i] ?? <span className="muted" style={{ fontSize: 15, fontWeight: 700 }}>{i + 1}</span> : '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={r.username} size={30} />
                        <strong>{r.username}</strong>
                      </div>
                    </td>
                    <td className="num" style={{ fontSize: 17, fontWeight: 800 }}>{r.result ? r.wpm : '—'}</td>
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
                    <td><span className={`badge ${r.state.cls}`}>{r.state.label}</span></td>
                    <td><Sparkline points={r.live?.history ?? []} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{running ? '🏁 Live race' : '🚦 Starting line'}</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              {running ? 'Ranked by current speed · updates every 1.5s' : 'Waiting for the admin to start the race'}
            </span>
          </div>
          {rows.length === 0 ? (
            <div className="empty-state">
              <div className="big-emoji">👀</div>
              <p className="muted">
                No players yet.{' '}
                {c.status === 'draft' ? 'Open the competition so people can join.' : 'Share the home page link so people can join.'}
              </p>
            </div>
          ) : (
            <div className="lanes">
              {rows.map((r, i) => {
                const hasData = !!(r.result || r.live);
                const leader = running && hasData && i === 0 && r.wpm > 0;
                const runner = r.result ? '🏁' : r.state.cls === 'offline' ? '💤' : '🏃';
                return (
                  <div key={r.username} className={`lane ${leader ? 'leader' : ''}`}>
                    <div className="rank">{leader ? '👑' : hasData ? i + 1 : '·'}</div>
                    <div className="who">
                      <Avatar name={r.username} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div className="name" title={r.username}>{r.username}</div>
                        <div className="sub"><span className={`badge ${r.state.cls}`}>{r.state.label}</span></div>
                      </div>
                    </div>
                    <div className="track">
                      <div className="fill" style={{ width: `${Math.min(100, r.progress)}%` }} />
                      <span className="pct">{Math.round(r.progress)}%</span>
                      <span className="flag">🏁</span>
                      <span
                        className={`runner ${r.state.cls === 'typing' ? 'moving' : ''}`}
                        style={{ left: `calc(16px + (100% - 64px) * ${Math.min(100, r.progress) / 100})` }}
                      >
                        {runner}
                      </span>
                    </div>
                    <div className="speed">
                      <div>
                        <span className="wpm">{hasData ? r.wpm : '—'}</span>
                        <span className="unit">WPM</span>
                      </div>
                      <div className="acc">
                        {r.accuracy !== null ? `🎯 ${r.accuracy}%` : ''} {r.errors ? `· ${r.errors} err` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

const submittedMs = (r: Participant['result']) => (r ? new Date(r.submittedAt).getTime() : Infinity);

function Stat({ icon, label, value, danger }: { icon: string; label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="stat">
      <div className="label"><span className="icon">{icon}</span>{label}</div>
      <div className="value" style={danger ? { color: 'var(--bad)' } : undefined}>{value}</div>
    </div>
  );
}
