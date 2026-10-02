/**
 * Borra todo el esquema, aplica migraciones y vuelve a sembrar datos demo.
 *   pnpm db:reset
 */
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL
  if (url) {
    const sql = postgres(url, { max: 1, onnotice: () => {} })
    await sql.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;')
    await sql.end()
    console.log('✓ Esquema reiniciado')
  } else {
    rmSync(process.env.PGLITE_DIR ?? '.pglite', { recursive: true, force: true })
    console.log('✓ PGlite eliminado')
  }
  execSync('pnpm db:migrate', { stdio: 'inherit' })
  execSync('pnpm db:seed', { stdio: 'inherit' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
