'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from './client';

export default function AdminNav({ crumbs }: { crumbs?: { href?: string; label: string }[] }) {
  const router = useRouter();
  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    router.replace('/admin/login');
  }
  return (
    <div className="row between" style={{ marginBottom: 24 }}>
      <div className="row" style={{ gap: 8 }}>
        <Link href="/admin">Admin</Link>
        {crumbs?.map((c) => (
          <span key={c.label} className="row" style={{ gap: 8 }}>
            <span className="muted">/</span>
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
          </span>
        ))}
      </div>
      <button className="secondary" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
