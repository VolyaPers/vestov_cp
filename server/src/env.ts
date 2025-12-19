import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnvFile(filePath: string) {
  const exists = fs.existsSync(filePath)
  if (!exists) {
    console.warn(`[ENV] not found: ${filePath}`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  let loaded = 0
  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx === -1) return
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
      loaded += 1
    }
  })
  console.log(`[ENV] loaded ${loaded} entries from ${filePath}`)
}

// Load env from server/.env and project root .env (one level up)
loadEnvFile(path.join(__dirname, '../.env'))
loadEnvFile(path.join(__dirname, '../../.env'))



