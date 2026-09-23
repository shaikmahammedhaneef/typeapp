'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError, formatSeconds, useServerClock, useTick } from '@/components/client';
import { scoreTyping } from '@/lib/scoring';
import Avatar from '@/components/Avatar';
import Podium from '@/components/Podium';

interface Competition {
  id: number;
  title: string;
  durationSec: number;
  status: 'draft' | 'open' | 'running' | 'finished';
  startedAt: string | null;
  endsAt: string | null;
  serverNow: string;
  passage: string | null;
}
interface Result {
  wpm: number;
  rawWpm?: number;
  accuracy: number;
  errors: number;
  correctChars: number;
  typedChars: number;
  elapsedSec: number;
  source: string;
}
interface LeaderRow { rank: number; username: string; wpm: number; accuracy: number; errors: number }
interface State {
  competition: Competition;
  playerCount: number;
  me: { username: string };
  result: Result | null;
  leaderboard: LeaderRow[] | null;
}

const WAIT_POLL_MS = 1500;
const PROGRESS_MS = 1500;
const AFTER_POLL_MS = 3000;

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clock = useServerClock();
  const [state, setState] = useState<State | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const typedRef = useRef('');
  const submittedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const c = state?.competition;
  const result = state?.result ?? null;
  const startMs = c?.startedAt ? new Date(c.startedAt).getTime() : null;
  const endMs = c?.endsAt ? new Date(c.endsAt).getTime() : null;
  const now = clock.now();
  const beforeStart = startMs !== null && now < startMs;
  const timeUp = endMs !== null && now >= endMs;
  const racing =
    !!c?.passage && (c.status === 'running' || c.status === 'finished') && !result && !submittedRef.current;
  const canType = racing && !beforeStart && !timeUp && c?.status === 'running';

  useTick(100, !!c && (c.status === 'running' || beforeStart));

  const loadState = useCallback(async () => {
    const sentAt = Date.now();
    try {
      const s = await api<State>(`/api/play/${id}/state`);
      clock.sync(s.competition.serverNow, sentAt);
      if (s.result) submittedRef.current = true;
      setState(s);
      setError('');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        router.replace('/');
        return;
      }
      setError('Connection problem — retrying…');
    }
  }, [id, clock, router]);

  const submit = useCallback(
    async (source: 'manual' | 'timer') => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        await api(`/api/play/${id}/submit`, {
          method: 'POST',
          body: JSON.stringify({ typed: typedRef.current, source }),
        });
      } catch (err) {
        // 409 = already submitted or window closed; the server keeps our last progress either way.
        if (!(err instanceof ApiError && err.status === 409)) {
          submittedRef.current = false;
          setError('Could not submit — retrying…');
          setSubmitting(false);
          setTimeout(() => submit(source), 1000);
          return;
        }
      }
      setSubmitting(false);
      await loadState();
    },
    [id, loadState],
  );

  // Polling: waiting room + after the race. During the race, progress requests carry status.
  useEffect(() => {
    loadState();
  }, [loadState]);
  useEffect(() => {
    if (!state || racing) return;
    if (state.competition.status === 'finished' && state.leaderboard) return;
    const t = setInterval(loadState, result ? AFTER_POLL_MS : WAIT_POLL_MS);
    return () => clearInterval(t);
  }, [state, racing, result, loadState]);

  // Live progress heartbeat while typing.
  useEffect(() => {
    if (!racing || beforeStart) return;
    const t = setInterval(async () => {
      const sentAt = Date.now();
      try {
        const res = await api<{ competition: Competition }>(`/api/play/${id}/progress`, {
          method: 'POST',
          body: JSON.stringify({ typed: typedRef.current }),
        });
        clock.sync(res.competition.serverNow, sentAt);
        if (res.competition.status === 'finished' || res.competition.endsAt !== c?.endsAt) {
          // Admin ended the race early (or changed the deadline): pick up the new timing.
          setState((s) => (s ? { ...s, competition: { ...s.competition, ...res.competition } } : s));
        }
      } catch {
        /* next heartbeat will retry */
      }
    }, PROGRESS_MS);
    return () => clearInterval(t);
  }, [racing, beforeStart, id, clock, c?.endsAt]);

  // Auto-submit when time is up (or the admin ended the race).
  useEffect(() => {
    if (racing && !beforeStart && (timeUp || c?.status === 'finished')) submit('timer');
  }, [racing, beforeStart, timeUp, c?.status, submit]);

  // Focus the input the moment typing unlocks.
  useEffect(() => {
    if (canType) inputRef.current?.focus();
  }, [canType]);

  function onType(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (!canType || !c?.passage) return;
    const value = e.target.value.slice(0, c.passage.length);
    typedRef.current = value;
    setTyped(value);
    if (value.length === c.passage.length) submit('manual');
  }

  const block = (e: React.SyntheticEvent) => e.preventDefault();

  if (!state || !c) {
    return (
      <main className="container">
        <p className="muted">{error || 'Loading…'}</p>
      </main>
    );
  }

  // Waiting room
  if (c.status === 'open' || c.status === 'draft') {
    return (
      <main className="container narrow">
        <div className="hero">
          <h1>{c.title}</h1>
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <Avatar name={state.me.username} size={36} />
            <span className="muted">
              You are in as <strong style={{ color: 'var(--text)' }}>{state.me.username}</strong>
            </span>
          </div>
        </div>
        <div className="card stack" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>🚦</div>
          <div style={{ fontWeight: 600 }}>
            <span className="pulse" />
            Waiting for the admin to start the competition…
          </div>
          <div className="muted">
            {state.playerCount} player{state.playerCount === 1 ? '' : 's'} joined · {c.durationSec}s race
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Keep this page open. The typing screen will appear automatically.
          </div>
        </div>
      </main>
    );
  }

  // Results
  if (result || (c.status === 'finished' && !racing)) {
    const board = state.leaderboard;
    const myRank = board?.find((r) => r.username === state.me.username)?.rank;
    return (
      <main className="container" style={{ maxWidth: 960 }}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <div className="row">
            <Avatar name={state.me.username} size={44} />
            <div>
              <h1 style={{ margin: 0 }}>{c.title}</h1>
              <div className="muted">
                {myRank
                  ? `You finished #${myRank} of ${board!.length}${myRank <= 3 ? ' 🎉' : ''}`
                  : `Nice work, ${state.me.username}!`}
              </div>
            </div>
          </div>
        </div>
        {result ? (
          <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
            <Stat label="⚡ Your WPM" value={result.wpm} />
            <Stat label="🎯 Accuracy" value={`${result.accuracy}%`} />
            <Stat label="❌ Errors" value={result.errors} />
            <Stat label="⏱️ Time" value={formatSeconds(result.elapsedSec)} />
          </div>
        ) : (
          <div className="alert info" style={{ marginBottom: 20 }}>
            No result was recorded for you in this competition.
          </div>
        )}
        {board ? (
          <>
            {board.length > 0 && (
              <Podium
                title="Winners"
                top={board.slice(0, 3).map((r) => ({ username: r.username, wpm: r.wpm, accuracy: r.accuracy }))}
                highlight={state.me.username}
              />
            )}
            <div className="card">
              <h2>📋 Leaderboard</h2>
              <table>
                <thead>
                  <tr><th style={{ width: 60 }}>Rank</th><th>Player</th><th className="num">WPM</th><th className="num">Accuracy</th><th className="num">Errors</th></tr>
                </thead>
                <tbody>
                  {board.map((r) => (
                    <tr key={r.username} className={r.username === state.me.username ? 'me-row' : ''}>
                      <td className="medal-rank">{['🥇', '🥈', '🥉'][r.rank - 1] ?? <span className="muted" style={{ fontSize: 15, fontWeight: 700 }}>{r.rank}</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <Avatar name={r.username} size={28} />
                          <strong>{r.username}</strong>
                          {r.username === state.me.username && <span className="badge open">you</span>}
                        </div>
                      </td>
                      <td className="num" style={{ fontWeight: 800 }}>{r.wpm}</td>
                      <td className="num">{r.accuracy}%</td>
                      <td className="num">{r.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="card empty-state">
            <div className="big-emoji">⏳</div>
            <p className="muted">
              <span className="pulse" />
              Waiting for everyone to finish… the winners will appear here.
            </p>
          </div>
        )}
      </main>
    );
  }

  // Typing screen
  const passage = c.passage ?? '';
  const elapsed = startMs ? Math.max(0, (Math.min(now, endMs ?? now) - startMs) / 1000) : 0;
  const live = scoreTyping(passage, typed, elapsed);
  const remaining = endMs ? (endMs - now) / 1000 : 0;

  return (
    <main className="container">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{c.title}</h1>
        <span className="muted">Playing as {state.me.username}</span>
      </div>

      {beforeStart ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="muted" style={{ textAlign: 'center' }}>Get ready…</div>
          <div className="countdown">{Math.ceil((startMs! - now) / 1000)}</div>
        </div>
      ) : (
        <div className="hud">
          <div className={`stat timer ${remaining <= 10 ? 'low' : ''}`}>
            <div className="label">⏱️ Time left</div>
            <div className="value">{formatSeconds(remaining)}</div>
          </div>
          <Stat label="⚡ WPM" value={live.wpm} />
          <Stat label="🎯 Accuracy" value={`${live.accuracy}%`} />
          <Stat label="❌ Errors" value={live.errors} />
          <Stat label="🏁 Progress" value={`${Math.round(live.progressPct)}%`} />
        </div>
      )}

      <div
        className={`passage ${focused && canType ? 'focused' : ''} ${canType ? '' : 'locked'} ${beforeStart ? 'hidden-text' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {renderPassage(passage, typed)}
        {canType && !focused && <div className="focus-hint">Click here to keep typing</div>}
        <textarea
          ref={inputRef}
          className="typing-input"
          value={typed}
          onChange={onType}
          onPaste={block}
          onDrop={block}
          onCut={block}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={!canType}
          maxLength={passage.length}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Type the passage"
        />
      </div>

      <div className="row between" style={{ marginTop: 16 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {submitting
            ? 'Submitting…'
            : 'Your text is submitted automatically when time runs out or when you finish the passage.'}
        </span>
        {error && <span className="alert error">{error}</span>}
        <button className="secondary" disabled={!canType || submitting} onClick={() => submit('manual')}>
          Submit now
        </button>
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

function renderPassage(passage: string, typed: string) {
  return passage.split("").map((ch, i) => {
    let cls = 'c';
    if (i < typed.length) cls += typed[i] === ch ? ' ok' : ' bad';
    if (i === typed.length) cls += ' cur';
    const shown = ch === '\n' ? '↵\n' : ch;
    return (
      <span key={i} className={cls}>
        {shown}
      </span>
    );
  });
}
