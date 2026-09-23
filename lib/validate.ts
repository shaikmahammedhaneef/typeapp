import { normalizeText } from './scoring';

export interface CompetitionInput {
  title: string;
  passage: string;
  durationSec: number;
}

export function validateCompetitionInput(body: Record<string, unknown>): CompetitionInput | string {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const passage =
    typeof body.passage === 'string' ? normalizeText(body.passage).replace(/\s+$/, '').trim() : '';
  const durationSec = Number(body.durationSec);
  if (!title || title.length > 100) return 'Title is required (max 100 characters).';
  if (passage.length < 10 || passage.length > 10000) {
    return 'Competition text must be 10–10,000 characters.';
  }
  if (!Number.isInteger(durationSec) || durationSec < 10 || durationSec > 3600) {
    return 'Duration must be a whole number of seconds between 10 and 3600.';
  }
  return { title, passage, durationSec };
}
