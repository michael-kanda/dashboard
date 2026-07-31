import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '@vercel/postgres';

const migrationsDirectory = join(process.cwd(), 'migrations');
const client = await db.connect();

try {
  await client.sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const { rows } = await client.sql`
      SELECT 1 FROM schema_migrations WHERE name = ${file} LIMIT 1
    `;
    if (rows.length > 0) {
      console.log(`[Migration] bereits vorhanden: ${file}`);
      continue;
    }

    const migration = await readFile(join(migrationsDirectory, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(migration);
      await client.sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
      await client.query('COMMIT');
      console.log(`[Migration] angewendet: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
}
