import 'server-only';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { SCHEMA_STATEMENTS } from './schema';

type Rows = Record<string, any>[];

export interface Sql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Rows>;
  query(text: string, params?: unknown[]): Promise<Rows>;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

/**
 * Neon's HTTP driver in production. Set DB_DRIVER=pg to use a regular TCP connection instead
 * (for local development against a plain Postgres server).
 */
function createSql(url: string): Sql {
  if (process.env.DB_DRIVER !== 'pg') return neon(url) as unknown as Sql;

  const pool = new Pool({ connectionString: url, max: 10 });
  const query = async (text: string, params: unknown[] = []) => (await pool.query(text, params)).rows;
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) =>
    query(strings.reduce((acc, part, i) => `${acc}$${i}${part}`), values);
  return Object.assign(tag, { query });
}

export const sql = createSql(process.env.DATABASE_URL);

let schemaReady: Promise<void> | null = null;

/** Creates tables on first use in each server instance. Safe to call repeatedly. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await sql.query(statement);
      }
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
