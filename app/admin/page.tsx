'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import CompetitionForm from '@/components/CompetitionForm';
import { api } from '@/components/client';

interface Row {
  id: number;
  title: string;
  status: string;
  durationSec: number;
  startedAt: string | null;
  createdAt: string;
  playerCount: number;
  resultCount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    api<{ competitions: Row[] }>('/api/admin/competitions').then((d) => setRows(d.competitions));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <main className="container">
      <AdminNav />
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1>Competitions</h1>
        <button onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Cancel' : 'New competition'}</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>New competition</h2>
          <CompetitionForm
            submitLabel="Create"
            onSubmit={async (fields) => {
              const { id } = await api<{ id: number }>('/api/admin/competitions', {
                method: 'POST',
                body: JSON.stringify(fields),
              });
              router.push(`/admin/competitions/${id}`);
            }}
          />
        </div>
      )}

      <div className="card">
        {!rows ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No competitions yet. Create one to get started.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Status</th>
                <th className="num">Duration</th>
                <th className="num">Players</th>
                <th className="num">Results</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{r.id}</td>
                  <td>
                    <Link href={`/admin/competitions/${r.id}`}>{r.title}</Link>
                  </td>
                  <td>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </td>
                  <td className="num">{r.durationSec}s</td>
                  <td className="num">{r.playerCount}</td>
                  <td className="num">{r.resultCount}</td>
                  <td className="muted">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="row" style={{ justifyContent: 'flex-end' }}>
                    <Link className="btn secondary" href={`/admin/competitions/${r.id}`}>
                      Manage
                    </Link>
                    <Link className="btn secondary" href={`/admin/competitions/${r.id}/stats`}>
                      Stats
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
