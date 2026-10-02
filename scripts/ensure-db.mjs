/**
 * Se ejecuta antes de `next dev`: si DATABASE_URL apunta al Postgres local
 * (localhost:5433) y no está corriendo, lo levanta en segundo plano y espera.
 */
import 'dotenv/config'
import { spawn } from 'node:child_process'
import net from 'node:net'

const url = process.env.DATABASE_URL
const port = Number(process.env.LOCAL_PG_PORT ?? 5433)

if (!url || !new RegExp(`@(localhost|127\\.0\\.0\\.1):${port}/`).test(url)) process.exit(0)

const portOpen = () =>
  new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })

if (await portOpen()) process.exit(0)

console.log('[db] Iniciando Postgres local…')
if (process.platform === 'win32') {
  // Start-Process saca a Postgres del árbol de procesos de `next dev`, así
  // sobrevive a reinicios del servidor de desarrollo.
  spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Start-Process -FilePath '${process.execPath}' -ArgumentList 'scripts/db-server.mjs' -WorkingDirectory '${process.cwd()}' -WindowStyle Hidden`,
    ],
    { stdio: 'ignore', windowsHide: true },
  )
} else {
  const child = spawn(process.execPath, ['scripts/db-server.mjs'], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

for (let i = 0; i < 360; i++) {
  await new Promise((r) => setTimeout(r, 500))
  if (await portOpen()) {
    // Margen para que termine de crear la base de datos.
    await new Promise((r) => setTimeout(r, 1500))
    console.log(`[db] Postgres listo en el puerto ${port}`)
    process.exit(0)
  }
}
console.error('[db] Postgres no respondió a tiempo. Ejecuta `pnpm db:start` para ver el error.')
process.exit(1)
