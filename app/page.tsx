'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/client';

interface Current {
  competition: { id: number; title: string; status: string; durationSec: number; playerCount: number } | null;
  joinedAs: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [current, setCurrent] = useState<Current | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      api<Current>('/api/competition/current')
        .then((d) => active && setCurrent(d))
        .catch(() => {});
    load();
    // Keep checking so the page updates when the admin opens a competition.
    const t = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ competitionId: number }>('/api/join', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      router.push(`/play/${res.competitionId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const c = current?.competition;

  return (
    <main className="container narrow">
      <div className="hero">
        <div style={{ fontSize: 52, marginBottom: 8 }}>⌨️🏁</div>
        <h1>Ready to race?</h1>
        <p className="muted">Pick a username, join the competition and wait for the start.</p>
      </div>

      <div className="card stack">
        {!current && <p className="muted">Loading…</p>}
        {current && !c && (
          <div className="alert info">No competition is open right now. This page updates automatically.</div>
        )}
        {c && (
          <div className="row between">
            <div>
              <div style={{ fontWeight: 600 }}>{c.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {c.durationSec}s · {c.playerCount} player{c.playerCount === 1 ? '' : 's'} joined
              </div>
            </div>
            <span className={`badge ${c.status}`}>{c.status === 'open' ? 'Open' : 'In progress'}</span>
          </div>
        )}

        {c && current?.joinedAs && (
          <button className="big" onClick={() => router.push(`/play/${c.id}`)}>
            Continue as {current.joinedAs}
          </button>
        )}

        {c && !current?.joinedAs && c.status === 'open' && (
          <form onSubmit={join} className="stack">
            <div>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                autoFocus
                autoComplete="off"
                maxLength={20}
                placeholder="e.g. speedy_fingers"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {error && <div className="alert error">{error}</div>}
            <button className="big" style={{ width: '100%' }} disabled={busy || username.trim().length < 2}>
              {busy ? 'Joining…' : 'Enter competition'}
            </button>
          </form>
        )}

        {c && !current?.joinedAs && c.status === 'running' && (
          <div className="alert info">
            This competition has already started. You can join the next one when it opens.
          </div>
        )}
      </div>
    </main>
  );
}
