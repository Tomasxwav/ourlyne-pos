import 'dotenv/config'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { createDb } from '../src/db/client'

async function main() {
  const db = createDb()
  const migrationsFolder = './drizzle'
  if (process.env.DATABASE_URL) {
    await migratePostgres(db, { migrationsFolder })
    await db.$client.end()
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migratePglite(db as any, { migrationsFolder })
  }
  console.log('✓ Migraciones aplicadas')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
