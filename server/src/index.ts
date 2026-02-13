import './env.js'
import express from 'express'
import { createServer } from 'http'
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
import { feedbackRouter } from './routes/feedback.js'
import { financesRouter } from './routes/finances.js'
import { settingsRouter } from './routes/settings.js'
import { setupPassport } from './auth/passport.js'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import { getAppliedMigrations, checkColumnExists, ensureIsActiveColumn, ensureUserColumns, ensureFinanceTables } from './utils/migrations.js'
import { initializeSocket } from './socket.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)
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
    // Try dist/drizzle first (for production builds), then fall back to ../drizzle (for development)
    const migrationsPathInDist = path.join(__dirname, 'drizzle')
    const migrationsPathInParent = path.join(__dirname, '../drizzle')
    const migrationsPath = fs.existsSync(migrationsPathInDist) ? migrationsPathInDist : migrationsPathInParent
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
    await ensureFinanceTables(pool)
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
      await ensureFinanceTables(pool)
      console.log('[MIGRATIONS] ✓ Added missing user columns and finance tables as fallback')
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

// Normalize CORS origin - remove trailing slashes
const normalizeUrl = (url: string | undefined): string | false => {
  if (!url) return false
  return url.trim().replace(/\/+$/, '') // Remove trailing slashes
}

const corsOriginRaw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL
const corsOrigin = corsOriginRaw 
  ? normalizeUrl(corsOriginRaw) 
  : (process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://vestovcp.local:5173'])

console.log('[SERVER INIT] CORS Origin:', corsOrigin)
console.log('[SERVER INIT] CORS Environment variables:', {
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  FRONTEND_URL: process.env.FRONTEND_URL,
  CORS_ORIGIN_NORMALIZED: corsOrigin,
  NODE_ENV: process.env.NODE_ENV,
})

// CORS logging and header injection middleware (for debugging and ensuring CORS headers)
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin || req.method === 'OPTIONS') {
    console.log('[CORS DEBUG] Request:', {
      method: req.method,
      path: req.path,
      origin: origin || 'no origin',
      corsOrigin: corsOrigin,
    })
  }
  
  // Ensure CORS headers are set on all responses
  if (origin && corsOrigin) {
    const normalizedOrigin = normalizeUrl(origin)
    
    // Handle array of allowed origins
    if (Array.isArray(corsOrigin)) {
      const normalizedOrigins = corsOrigin.map(o => normalizeUrl(o)).filter((o): o is string => typeof o === 'string')
      if (normalizedOrigins.some(allowed => normalizedOrigin === allowed || origin === allowed)) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
    } else {
      // Handle single origin
      const normalizedCorsOrigin = typeof corsOrigin === 'string' ? corsOrigin : false
      if (normalizedCorsOrigin && (normalizedOrigin === normalizedCorsOrigin || origin === normalizedCorsOrigin)) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
    }
  }
  
  next()
})

// CORS configuration with origin function for better matching
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true)
    }
    
    const normalizedOrigin = normalizeUrl(origin)
    
    // Handle array of allowed origins (for development)
    if (Array.isArray(corsOrigin)) {
      const normalizedOrigins = corsOrigin.map(o => normalizeUrl(o)).filter((o): o is string => typeof o === 'string')
      if (normalizedOrigins.some(allowed => normalizedOrigin === allowed || origin === allowed)) {
        console.log('[CORS] Allowing origin:', origin)
        return callback(null, true)
      }
    } else {
      // Handle single origin (string or false)
      const normalizedCorsOrigin = typeof corsOrigin === 'string' ? corsOrigin : false
      
      if (normalizedCorsOrigin && (normalizedOrigin === normalizedCorsOrigin || origin === normalizedCorsOrigin)) {
        console.log('[CORS] Allowing origin:', origin)
        return callback(null, true)
      }
    }
    
    console.log('[CORS] Rejecting origin:', origin, 'Expected:', corsOrigin)
    callback(new Error('Not allowed by CORS'))
  },
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
    schemaName: 'public',
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
app.use('/api/feedback', feedbackRouter)
app.use('/api/finances', financesRouter)
app.use('/api/settings', settingsRouter)

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const error = err as Error
  console.error('========================================')
  console.error('[GLOBAL ERROR HANDLER] Unhandled error:')
  console.error('[GLOBAL ERROR HANDLER] Message:', error.message)
  console.error('[GLOBAL ERROR HANDLER] Stack:', error.stack)
  console.error('[GLOBAL ERROR HANDLER] Request:', {
    method: req.method,
    path: req.path,
    url: req.url,
    origin: req.headers.origin,
  })
  console.error('========================================')
  
  const origin = req.headers.origin
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
  })
})

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

async function runOrphanedTeamMembersFix() {
  try {
    // Check if script has already run
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'script_execution_log'
      ) as table_exists
    `)
    
    if (!result.rows[0]?.table_exists) {
      // Create log table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS script_execution_log (
          id SERIAL PRIMARY KEY,
          script_name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT NOW(),
          status VARCHAR(50) NOT NULL
        )
      `)
    }

    // Check if this script has already run
    const checkResult = await pool.query(`
      SELECT executed_at FROM script_execution_log 
      WHERE script_name = 'fix-orphaned-team-members'
    `)

    if (checkResult.rows.length > 0) {
      console.log('[ORPHANED FIX] Script already executed at:', checkResult.rows[0].executed_at)
      return
    }

    console.log('[ORPHANED FIX] Running fix for orphaned team members...')
    await pool.query(`
      INSERT INTO script_execution_log (script_name, status) 
      VALUES ('fix-orphaned-team-members', 'running')
      ON CONFLICT (script_name) DO NOTHING
    `)

    // Run the fix function inline (doesn't exit process, suitable for server startup)
    const { db } = await import('./db/index.js')
    const { teamMembers, users } = await import('./db/schema.js')
    const { eq, isNull, sql } = await import('drizzle-orm')
    const { createUserAccount } = await import('./services/userService.js')

    // Find orphaned team members
    const linkedTeamMemberIds = await db
      .select({ id: users.teamMemberId })
      .from(users)
      .where(sql`${users.teamMemberId} IS NOT NULL`)

    const linkedIds = new Set(linkedTeamMemberIds.map(u => u.id).filter((id): id is number => id !== null))
    const allMembers = await db.select().from(teamMembers)
    const orphanedMembers = allMembers.filter(member => !linkedIds.has(member.id))

    if (orphanedMembers.length === 0) {
      console.log('[ORPHANED FIX] ✅ No orphaned team members found. All team members are linked to users.')
      await pool.query(`
        UPDATE script_execution_log 
        SET status = 'completed', executed_at = NOW()
        WHERE script_name = 'fix-orphaned-team-members'
      `)
      return
    }

    console.log(`[ORPHANED FIX] 📊 Found ${orphanedMembers.length} orphaned team member(s) to process`)

    console.log(`[ORPHANED FIX] Found ${orphanedMembers.length} orphaned team member(s)`)

    let created = 0
    let deleted = 0
    let errors = 0

    for (const member of orphanedMembers) {
      if (!member.email || member.email.trim() === '') {
        console.log(`[ORPHANED FIX] 🗑️  Deleting team member ${member.id} (${member.name}) - no email address`)
        await db.delete(teamMembers).where(eq(teamMembers.id, member.id))
        deleted++
        continue
      }

      const normalizedEmail = member.email.trim().toLowerCase()
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      if (existingUser && existingUser.role === 'team_member' && !existingUser.teamMemberId) {
        await db
          .update(users)
          .set({ teamMemberId: member.id, updatedAt: new Date() })
          .where(eq(users.id, existingUser.id))
        created++
        console.log(`[ORPHANED FIX] ✅ Linked existing user ${existingUser.id} to team member ${member.id}`)
      } else if (!existingUser) {
        try {
          const username = normalizedEmail.split('@')[0]
          await createUserAccount({
            username,
            password: crypto.randomUUID(),
            fullName: member.name,
            email: normalizedEmail,
            role: 'team_member',
            position: member.role || 'Team Member',
            teamMemberId: member.id,
            source: 'orphaned_fix',
            isActive: true
          })
          created++
          console.log(`[ORPHANED FIX] ✅ Created user for team member ${member.id} (${normalizedEmail})`)
        } catch (error) {
          console.error(`[ORPHANED FIX] ❌ Error creating user for team member ${member.id} (${normalizedEmail}):`, error)
          errors++
        }
      } else {
        const reason = existingUser.role !== 'team_member' 
          ? `User has role '${existingUser.role}' instead of 'team_member'`
          : existingUser.teamMemberId 
            ? `User already linked to team member ${existingUser.teamMemberId}`
            : 'Unknown reason'
        console.warn(`[ORPHANED FIX] ⚠️  Skipping team member ${member.id} (${normalizedEmail}): ${reason}`)
        errors++
      }
    }

    console.log(`[ORPHANED FIX] 📋 Summary:`)
    console.log(`[ORPHANED FIX]   ✅ Users created/linked: ${created}`)
    console.log(`[ORPHANED FIX]   🗑️  Team members deleted: ${deleted}`)
    console.log(`[ORPHANED FIX]   ⚠️  Errors (require manual review): ${errors}`)
    
    const finalStatus = errors > 0 ? 'completed_with_errors' : 'completed'
    await pool.query(`
      UPDATE script_execution_log 
      SET status = $1, executed_at = NOW()
      WHERE script_name = 'fix-orphaned-team-members'
    `, [finalStatus])
    
    if (errors > 0) {
      console.log(`[ORPHANED FIX] ⚠️  Script completed with ${errors} error(s). Please review the logs above.`)
    } else {
      console.log(`[ORPHANED FIX] ✅ Script completed successfully!`)
    }
  } catch (error) {
    console.error('[ORPHANED FIX] Error:', error)
    await pool.query(`
      UPDATE script_execution_log 
      SET status = 'failed', executed_at = NOW()
      WHERE script_name = 'fix-orphaned-team-members'
    `)
  }
}

runMigrations().then(async () => {
  await runOrphanedTeamMembersFix()

  // Initialize Socket.IO
  initializeSocket(httpServer, corsOrigin)

  httpServer.listen(PORT, () => {
    console.log('========================================')
    console.log(`[SERVER START] ✅ Server running on port ${PORT}`)
    console.log(`[SERVER START] Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`[SERVER START] CORS Origin: ${corsOrigin}`)
    console.log(`[SERVER START] Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
    console.log(`[SERVER START] WebSocket: enabled`)
    console.log('========================================')
  })
}).catch((err) => {
  console.error('========================================')
  console.error('[SERVER START] ❌ Failed to start server:', err)
  console.error('========================================')
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})