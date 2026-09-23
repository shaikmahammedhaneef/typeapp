// Shared by server (authoritative) and client (live display only).

export interface Score {
  typedChars: number;
  correctChars: number;
  errors: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  progressPct: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** Character-by-character comparison against the passage; WPM uses the standard 5 chars per word. */
export function scoreTyping(passage: string, typedRaw: string, elapsedSec: number): Score {
  const typed = normalizeText(typedRaw).slice(0, passage.length);
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === passage[i]) correct++;
  }
  const minutes = Math.max(elapsedSec, 1) / 60;
  return {
    typedChars: typed.length,
    correctChars: correct,
    errors: typed.length - correct,
    wpm: round1(correct / 5 / minutes),
    rawWpm: round1(typed.length / 5 / minutes),
    accuracy: typed.length ? round1((correct / typed.length) * 100) : 0,
    progressPct: passage.length ? round1((typed.length / passage.length) * 100) : 0,
  };
}
