import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import postgres from 'postgres'
import * as schema from './schema'

export const PGLITE_DIR = process.env.PGLITE_DIR ?? './.pglite'

export function createDb() {
  const url = process.env.DATABASE_URL
  if (url) {
    // Las columnas timestamp (sin zona) se guardan y leen siempre en UTC.
    const client = postgres(url, {
      max: Number(process.env.DB_POOL_MAX ?? 10),
      connection: { TimeZone: 'UTC' },
    })
    return drizzlePostgres(client, { schema, casing: 'snake_case' })
  }
  const client = new PGlite(PGLITE_DIR)
  // PGlite ejecuta en orden: esto se aplica antes de cualquier consulta.
  void client.exec("SET TIME ZONE 'UTC'")
  // Ambos drivers comparten el dialecto de Postgres; se expone un único tipo.
  return drizzlePglite(client, {
    schema,
    casing: 'snake_case',
  }) as unknown as ReturnType<typeof drizzlePostgres<typeof schema>>
}

export type Database = ReturnType<typeof createDb>
