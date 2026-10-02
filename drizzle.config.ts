import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL

/*
 * `drizzle-kit generate` no necesita conexión. Para `push`/`studio` se requiere
 * DATABASE_URL (Postgres). En local sin Postgres, las migraciones se aplican a
 * PGlite con `pnpm db:migrate` (scripts/migrate.ts).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  ...(url ? { dbCredentials: { url } } : {}),
})
