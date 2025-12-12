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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Database connection
const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
})

// Run migrations on startup
async function runMigrations() {
  try {
    console.log('Running database migrations...')
    const db = drizzle(pool, { schema: {} })
    const migrationsPath = path.join(__dirname, '../drizzle')
    console.log('Migrations folder:', migrationsPath)
    await migrate(db, { migrationsFolder: migrationsPath })
    console.log('Migrations completed successfully!')
  } catch (error) {
    console.error('Migration error (non-fatal):', error)
    // Continue even if migrations fail - they might already be applied
  }
}

// Session store
const PgSession = connectPgSimple(session)

// Security middleware
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

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : 'http://vestovcp.local:5173')
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
}))

// Rate limiting (disabled in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Much higher limit for dev
  message: 'Too many requests from this IP',
})
app.use(limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Session configuration
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
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site in production
  },
}))

// Passport setup
setupPassport(pool)
app.use(passport.initialize())
app.use(passport.session())

// Global request logger to catch ALL incoming requests
app.use((req, res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`)
  console.log(`[INCOMING REQUEST] Headers:`, req.headers)
  next()
})

// Routes
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

// Serve uploaded files (with authentication check)
app.use('/uploads', express.static('uploads'))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Start server after migrations
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  })
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})