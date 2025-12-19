import './env.js'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pg from 'pg'
import connectPgSimple from 'connect-pg-simple'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { clientRouter } from './routes/client.js'
import { servicesRouter } from './routes/services.js'
import { invoiceRouter } from './routes/invoice.js'
import vacationRouter from './routes/vacation.js'
import { documentsRouter } from './routes/documents.js'
import { clientContactsRouter } from './routes/client-contacts.js'
import usersRouter from './routes/users.js'
import reimbursementsRouter from './routes/reimbursements.js'
import roadmapRouter from './routes/roadmap.js'
import shiftsRouter from './routes/shifts.js'
import { setupPassport } from './auth/passport.js'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getAppliedMigrations, checkColumnExists, ensureIsActiveColumn, ensureUserColumns } from './utils/migrations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

const trustProxy = process.env.NODE_ENV === 'production'
app.set('trust proxy', trustProxy ? 1 : false)

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
})

async function runMigrations() {
  try {
    console.log('========================================')
    console.log('[MIGRATIONS] Starting database migrations...')
    console.log('========================================')
    
    const db = drizzle(pool, { schema: {} })
    const migrationsPath = path.join(__dirname, '../drizzle')
    console.log('[MIGRATIONS] Migrations folder:', migrationsPath)
    console.log('[MIGRATIONS] Database URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')
    
    try {
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql') && !f.startsWith('.'))
        .sort()
      console.log(`[MIGRATIONS] Available migration files: ${migrationFiles.length}`)
      migrationFiles.forEach(f => {
        console.log(`[MIGRATIONS]   - ${f}`)
      })
    } catch (fsError) {
      console.error('[MIGRATIONS] Could not read migrations folder:', fsError)
    }
    
    const appliedMigrations = await getAppliedMigrations(pool)
    console.log(`[MIGRATIONS] Already applied: ${appliedMigrations.length} migrations`)
    if (appliedMigrations.length > 0) {
      appliedMigrations.forEach(m => {
        console.log(`[MIGRATIONS]   ✓ ${m.name} (applied at ${m.created_at})`)
      })
    } else {
      console.log('[MIGRATIONS]   No migrations applied yet')
    }
    
    const columnExists = await checkColumnExists(pool, 'users', 'is_active')
    console.log('[MIGRATIONS] Column is_active exists before migration:', columnExists)
    
    console.log('[MIGRATIONS] Running Drizzle migrations...')
    await migrate(db, { migrationsFolder: migrationsPath })
    console.log('[MIGRATIONS] ✓ Drizzle migrations completed')
    
    const afterMigrations = await getAppliedMigrations(pool)
    console.log(`[MIGRATIONS] Total migrations in database: ${afterMigrations.length}`)
    if (afterMigrations.length > 0) {
      console.log('[MIGRATIONS] Most recent migrations:')
      afterMigrations.slice(0, 5).forEach(m => {
        console.log(`[MIGRATIONS]   ✓ ${m.name} (${m.created_at})`)
      })
    }
    
    await ensureUserColumns(pool)
    const columnExistsAfter = await checkColumnExists(pool, 'users', 'is_active')
    if (columnExistsAfter) {
      console.log('[MIGRATIONS] ✓ Column is_active verified - exists in database')
    }
    
    console.log('========================================')
    console.log('[MIGRATIONS] ✓ All migrations completed successfully!')
    console.log('========================================')
  } catch (error) {
    const err = error as Error & { code?: string; detail?: string }
    console.error('========================================')
    console.error('[MIGRATIONS] ✗ Migration error occurred!')
    console.error('========================================')
    console.error('[MIGRATIONS] Error message:', err.message)
    console.error('[MIGRATIONS] Error code:', err.code)
    console.error('[MIGRATIONS] Error detail:', err.detail)
    console.error('[MIGRATIONS] Full error:', error)
    console.error('========================================')
    
    try {
      await ensureUserColumns(pool)
      console.log('[MIGRATIONS] ✓ Added missing user columns as fallback')
    } catch (fallbackError) {
      console.error('[MIGRATIONS] Fallback failed:', fallbackError)
    }
  }
}

const PgSession = connectPgSimple(session)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : 'http://vestovcp.local:5173')
console.log('[SERVER INIT] CORS Origin:', corsOrigin)
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use((req, res, next) => {
  try {
    console.log(`[${new Date().toISOString()}] [INCOMING REQUEST] ${req.method} ${req.url}`)
    if (req.url?.includes('/google')) {
      console.log(`[GOOGLE OAUTH DEBUG] Request received for: ${req.url}`)
      console.log(`[GOOGLE OAUTH DEBUG] Full path: ${req.path}`)
      console.log(`[GOOGLE OAUTH DEBUG] Original URL: ${req.originalUrl}`)
    }
    console.log(`[INCOMING REQUEST] Headers:`, JSON.stringify(req.headers, null, 2))
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`[INCOMING REQUEST] Body:`, JSON.stringify(req.body, null, 2))
    }
  } catch (err) {
    console.error('[LOGGER ERROR]', err)
  }
  next()
})

const isProduction = process.env.NODE_ENV === 'production'
const isStaging = process.env.NODE_ENV === 'staging'
const isHttps = isProduction || isStaging || process.env.FORCE_HTTPS === 'true'

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'vestov.sid',
  cookie: {
    secure: isHttps,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: isHttps ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
}))

setupPassport(pool)
app.use(passport.initialize())
app.use(passport.session())

// Debug middleware for Google OAuth routes
app.use('/api', (req, res, next) => {
  if (req.path === '/google' || req.path === '/auth/google' || req.url?.includes('google')) {
    console.log('========================================')
    console.log('[ROUTE DEBUG] Request path:', req.path)
    console.log('[ROUTE DEBUG] Request URL:', req.url)
    console.log('[ROUTE DEBUG] Original URL:', req.originalUrl)
    console.log('[ROUTE DEBUG] Method:', req.method)
    console.log('========================================')
  }
  next()
})

app.use('/api', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/client', clientRouter)
app.use('/api/services', servicesRouter)
app.use('/api/invoices', invoiceRouter)
app.use('/api/vacation', vacationRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/client-contacts', clientContactsRouter)
app.use('/api/users', usersRouter)
app.use('/api/reimbursements', reimbursementsRouter)
app.use('/api/roadmap', roadmapRouter)
app.use('/api/shifts', shiftsRouter)

app.use('/uploads', express.static('uploads'))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const error = err as Error
  console.error('Error:', error)
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
  })
})

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`[SERVER START] Server running on port ${PORT}`)
    console.log(`[SERVER START] Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`[SERVER START] CORS Origin: ${corsOrigin}`)
    console.log(`[SERVER START] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
  })
}).catch((err) => {
  console.error('[SERVER START] Failed to start server:', err)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})