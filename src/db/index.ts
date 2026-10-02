import 'server-only'
import { createDb, type Database } from './client'

const globalForDb = globalThis as unknown as { __ourlyneDb?: Database }

/**
 * Instancia única de Drizzle. Con `DATABASE_URL` se conecta a Postgres;
 * sin ella usa PGlite (Postgres embebido en `./.pglite`) para desarrollo local.
 */
export const db: Database = globalForDb.__ourlyneDb ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForDb.__ourlyneDb = db

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export type DbOrTx = Database | Transaction
