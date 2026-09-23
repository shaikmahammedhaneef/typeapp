// Creates the database tables. Usage: DATABASE_URL=... npm run db:migrate
// (The app also creates them automatically on first request.)
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const source = readFileSync(new URL('../lib/schema.ts', import.meta.url), 'utf8');
const statements = [...source.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const sql = neon(url);
for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Applied ${statements.length} schema statements.`);
