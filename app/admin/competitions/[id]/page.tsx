'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import CompetitionForm from '@/components/CompetitionForm';
import { api, formatSeconds, useServerClock, useTick } from '@/components/client';

interface Detail {
  competition: {
    id: number;
    title: string;
    passage: string;
    durationSec: number;
    status: 'draft' | 'open' | 'running' | 'finished';
    startedAt: string | null;
    endsAt: string | null;
    serverNow: string;
  };
  players: { username: string; joinedAt: string }[];
}

export default function ManageCompetition() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clock = useServerClock();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sentAt = Date.now();
    try {
      const d = await api<Detail>(`/api/admin/competitions/${id}`);
      clock.sync(d.competition.serverNow, sentAt);
      setData(d);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, clock]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const c = data?.competition;
  useTick(500, c?.status === 'running');

  async function action(name: 'open' | 'close' | 'start' | 'end') {
    if (name === 'end' && !confirm('End the competition now? Everyone is auto-submitted.')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/competitions/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: name }),
      });
      await load();
      if (name === 'start') router.push(`/admin/competitions/${id}/stats`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this competition and all of its results? This cannot be undone.')) return;
    try {
      await api(`/api/admin/competitions/${id}`, { method: 'DELETE' });
      router.replace('/admin');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!c) {
    return (
      <main className="container">
        <AdminNav />
        <p className="muted">{error || 'Loading…'}</p>
      </main>
    );
  }

  const editable = c.status === 'draft' || c.status === 'open';
  const remaining = c.endsAt ? (new Date(c.endsAt).getTime() - clock.now()) / 1000 : 0;

  return (
    <main className="container">
      <AdminNav crumbs={[{ label: c.title }]} />
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row">
          <h1 style={{ margin: 0 }}>{c.title}</h1>
          <span className={`badge ${c.status}`}>{c.status}</span>
          {c.status === 'running' && <span className="muted">{formatSeconds(remaining)} left</span>}
        </div>
        <div className="row">
          <Link className="btn secondary" href={`/admin/competitions/${id}/stats`}>
            {c.status === 'running' ? 'Live stats' : 'Stats'}
          </Link>
          {c.status === 'draft' && (
            <button disabled={busy} onClick={() => action('open')}>Open for joining</button>
          )}
          {c.status === 'open' && (
            <>
              <button className="secondary" disabled={busy} onClick={() => action('close')}>Close joining</button>
              <button className="success" disabled={busy || data.players.length === 0} onClick={() => action('start')}>
                Start competition
              </button>
            </>
          )}
          {c.status === 'running' && (
            <button className="danger" disabled={busy} onClick={() => action('end')}>End now</button>
          )}
        </div>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}
      {c.status === 'open' && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          Players can now join from the home page. Press <strong>Start competition</strong> when everyone is in —
          their screens switch to typing automatically after a 5-second countdown.
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2>Competition text</h2>
          {!editable && (
            <p className="muted" style={{ marginTop: -8 }}>
              The text can’t be changed once the competition has started.
            </p>
          )}
          <CompetitionForm
            key={`${c.id}-${editable}`}
            initial={{ title: c.title, passage: c.passage, durationSec: c.durationSec }}
            submitLabel="Save changes"
            disabled={!editable}
            onSubmit={async (fields) => {
              await api(`/api/admin/competitions/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
              await load();
            }}
          />
        </div>
        <div className="card">
          <h2>Players ({data.players.length})</h2>
          {data.players.length === 0 ? (
            <p className="muted">
              {c.status === 'draft' ? 'Open the competition to let players join.' : 'No one has joined yet.'}
            </p>
          ) : (
            <table>
              <tbody>
                {data.players.map((p) => (
                  <tr key={p.username}>
                    <td>{p.username}</td>
                    <td className="muted num">{new Date(p.joinedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {c.status !== 'running' && (
        <div style={{ marginTop: 24 }}>
          <button className="danger" onClick={remove}>Delete competition</button>
        </div>
      )}
    </main>
  );
}
