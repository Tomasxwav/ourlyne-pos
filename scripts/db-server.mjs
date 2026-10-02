/**
 * Servidor Postgres local (binarios oficiales vía `embedded-postgres`, sin
 * Docker). Persiste en ./.pgdata y escucha en LOCAL_PG_PORT (5433).
 * Lo inicia automáticamente `pnpm dev` (scripts/ensure-db.mjs) o manualmente:
 *
 *   pnpm db:start
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433)
const DIR = path.resolve(process.env.LOCAL_PG_DIR ?? '.pgdata')
const DB_NAME = process.env.LOCAL_PG_DB ?? 'ourlyne_pos'

const portOpen = () =>
  new Promise((resolve) => {
    const socket = net.connect(PORT, '127.0.0.1')
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })

if (await portOpen()) {
  console.log(`[db] Postgres ya está corriendo en el puerto ${PORT}`)
  process.exit(0)
}

const pg = new EmbeddedPostgres({
  databaseDir: DIR,
  port: PORT,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (e) => console.error('[db]', e),
})

if (!fs.existsSync(path.join(DIR, 'PG_VERSION'))) {
  console.log('[db] Inicializando clúster en', DIR)
  await pg.initialise()
}

// Tras un cierre abrupto puede quedar un postmaster.pid huérfano.
const pid = path.join(DIR, 'postmaster.pid')
if (fs.existsSync(pid)) fs.rmSync(pid)

await pg.start()
try {
  await pg.createDatabase(DB_NAME)
  console.log(`[db] Base de datos "${DB_NAME}" creada`)
} catch {
  /* ya existe */
}
console.log(`[db] Postgres listo en postgres://postgres:postgres@localhost:${PORT}/${DB_NAME}`)

const shutdown = async () => {
  await pg.stop().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
setInterval(() => {}, 1 << 30)
