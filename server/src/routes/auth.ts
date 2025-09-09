import { Router } from 'express'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Rate limiting for login attempts (disabled in development)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 1000, // Much higher limit for dev
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

// Login route
router.post('/login', loginLimiter, (req, res, next) => {
  console.log('Login attempt:', req.body.username)
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      console.error('Login error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
    
    if (!user) {
      console.log('Login failed:', info?.message)
      return res.status(401).json({ error: info?.message || 'Invalid credentials' })
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Session login error:', err)
        return res.status(500).json({ error: 'Login failed' })
      }
      
      console.log('Login successful for user:', user.username)
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          position: user.position,
          avatarUrl: user.avatarUrl,
          clientId: user.clientId,
          client: user.client,
        }
      })
    })
  })(req, res, next)
})

// Logout route
router.post('/logout', requireAuth, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ message: 'Logged out successfully' })
  })
})

// Get current user
router.get('/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json({
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      position: req.user.position,
      avatarUrl: req.user.avatarUrl,
      clientId: req.user.clientId,
      client: req.user.client,
    })
  } else {
    res.status(401).json({ error: 'Not authenticated' })
  }
})

export { router as authRouter }