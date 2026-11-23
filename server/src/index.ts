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
import { stripeWebhook } from './routes/stripe-billing.js'
import { invoiceRouter } from './routes/invoice.js'
import { clientCalendarRouter } from './routes/client-calendar.js'
import { runDatabaseMigrations } from './db/migrate.js'
import vacationRouter from './routes/vacation.js'
import { uploadsRouter } from './routes/uploads.js'
import { documentsRouter } from './routes/documents.js'
import { clientContactsRouter } from './routes/client-contacts.js'
import usersRouter from './routes/users.js'
import reimbursementsRouter from './routes/reimbursements.js'
import roadmapRouter from './routes/roadmap.js'
import shiftsRouter from './routes/shifts.js'
import { feedbackRouter } from './routes/feedback.js'
import { financesRouter } from './routes/finances.js'
import { settingsRouter } from './routes/settings.js'
import { searchRouter } from './routes/search.js'
import { clickupRouter } from './routes/clickup.js'
import { projectBotRouter } from './routes/project-bot.js'
import { workflowRouter } from './routes/workflow.js'
import { mcpRouter } from './mcp/server.js'
import { aiInsightsRouter } from './routes/ai-insights.js'
import { startWorkflowScheduler } from './services/workflowNotifications.js'
import { setupPassport } from './auth/passport.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import { initializeSocket } from './socket.js'
import { startClickUpScheduler } from './services/clickup.js'
import { startProjectBotScheduler } from './services/projectBot.js'

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

app.use('/api/mcp', mcpRouter)

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
  skip: (req) => req.path.startsWith('/api/project-bot/slack/'),
})
app.use(limiter)

const captureRawBody = (req: express.Request, _res: express.Response, buffer: Buffer) => {
  const rawRequest = req as express.Request & { rawBody?: Buffer }
  rawRequest.rawBody = Buffer.from(buffer)
}

app.use(express.json({ limit: '10mb', verify: captureRawBody }))
app.post('/api/stripe/invoice-events', stripeWebhook)
app.use(express.urlencoded({ extended: true, limit: '10mb', verify: captureRawBody }))

const isProduction = process.env.NODE_ENV === 'production'
const isStaging = process.env.NODE_ENV === 'staging'
const isHttps = isProduction || isStaging || process.env.FORCE_HTTPS === 'true'
if (isHttps && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error('SESSION_SECRET must contain at least 32 characters outside local development')

const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    schemaName: 'public',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
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
})
app.use(sessionMiddleware)

setupPassport(pool)
app.use(passport.initialize())
app.use(passport.session())

app.use('/api', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/client', clientRouter)
app.use('/api/services', servicesRouter)
app.use('/api/invoices', invoiceRouter)
app.use('/api/vacation', clientCalendarRouter)
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
app.use('/api/search', searchRouter)
app.use('/api/clickup', clickupRouter)
app.use('/api/project-bot', projectBotRouter)
app.use('/api/workflow', workflowRouter)
app.use('/api/admin/ai-insights', aiInsightsRouter)

app.use('/api/uploads', uploadsRouter)
app.use('/uploads', uploadsRouter)

app.get('/health', (req, res) => {
  const revision = process.env.RENDER_GIT_COMMIT?.match(/^[0-9a-f]{40}$/i)?.[0].slice(0, 12)
  res.json({ status: 'ok', timestamp: new Date().toISOString(), revision })
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
    origin: req.headers.origin,
  })
  console.error('========================================')
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
  })
})

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

runDatabaseMigrations(pool).then(async () => {

  // Initialize Socket.IO
  initializeSocket(httpServer, corsOrigin, sessionMiddleware)
  startClickUpScheduler()
  startProjectBotScheduler()
  startWorkflowScheduler()

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
