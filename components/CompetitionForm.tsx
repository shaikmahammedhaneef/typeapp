'use client';

import { useState } from 'react';

export interface CompetitionFields {
  title: string;
  passage: string;
  durationSec: number;
}

export default function CompetitionForm({
  initial,
  submitLabel,
  disabled,
  onSubmit,
}: {
  initial?: CompetitionFields;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (fields: CompetitionFields) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [passage, setPassage] = useState(initial?.passage ?? '');
  const [duration, setDuration] = useState(String(initial?.durationSec ?? 60));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await onSubmit({ title, passage, durationSec: Number(duration) });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="stack">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 3 }}>
          <label htmlFor="title">Title</label>
          <input id="title" value={title} maxLength={100} disabled={disabled} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="duration">Duration (seconds)</label>
          <input
            id="duration"
            type="number"
            min={10}
            max={3600}
            value={duration}
            disabled={disabled}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="passage">
          Competition text ({passage.length} characters, ~{Math.round(passage.length / 5)} words)
        </label>
        <textarea
          id="passage"
          rows={8}
          value={passage}
          disabled={disabled}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="Paste or type the text players must type…"
        />
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="row">
        <button disabled={busy || disabled}>{busy ? 'Saving…' : submitLabel}</button>
        {saved && <span className="muted">Saved.</span>}
      </div>
    </form>
  );
}
