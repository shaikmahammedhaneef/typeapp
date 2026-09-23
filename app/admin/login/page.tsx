'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/components/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Only allow redirects back into the admin area (no open redirects).
  const nextParam = params.get('next') ?? '';
  const next = /^\/admin(\/[\w\-/]*)?$/.test(nextParam) ? nextParam : '/admin';

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={login} className="card stack">
      <h2>Admin login</h2>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <div className="alert error">{error}</div>}
      <button disabled={busy || !password} style={{ width: '100%' }}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="container narrow" style={{ paddingTop: 80 }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
