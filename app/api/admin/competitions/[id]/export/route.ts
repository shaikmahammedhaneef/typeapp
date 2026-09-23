import { getCompetition } from '@/lib/competitions';
import { error, isAdmin, parseId } from '@/lib/http';
import { getParticipantStats } from '@/lib/liveStats';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection from usernames.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const submittedMs = (r: { submittedAt: unknown } | null) =>
  r ? new Date(r.submittedAt as string).getTime() : Infinity;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return error('Unauthorized', 401);
  const id = parseId((await params).id);
  const c = id && (await getCompetition(id));
  if (!c) return error('Competition not found', 404);

  const rows = (await getParticipantStats(c.id)).sort(
    (a, b) =>
      (b.result?.wpm ?? -1) - (a.result?.wpm ?? -1) ||
      (b.result?.accuracy ?? -1) - (a.result?.accuracy ?? -1) ||
      submittedMs(a.result) - submittedMs(b.result),
  );
  const header = ['rank', 'username', 'wpm', 'raw_wpm', 'accuracy_pct', 'errors', 'correct_chars',
    'typed_chars', 'elapsed_sec', 'submission', 'submitted_at'];
  const lines = rows.map((p, i) =>
    [
      p.result ? i + 1 : '',
      p.username,
      p.result?.wpm,
      p.result?.rawWpm,
      p.result?.accuracy,
      p.result?.errors,
      p.result?.correctChars,
      p.result?.typedChars,
      p.result?.elapsedSec?.toFixed(1),
      p.result?.source ?? 'no submission',
      p.result?.submittedAt ? new Date(p.result.submittedAt).toISOString() : '',
    ].map(csvCell).join(','),
  );
  const csv = [header.join(','), ...lines].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="competition-${c.id}-results.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
