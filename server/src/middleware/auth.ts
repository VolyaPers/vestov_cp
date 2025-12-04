import { Request, Response, NextFunction } from 'express'

export interface AuthenticatedUser {
  id: number
  username: string
  fullName: string
  email: string
  role: 'admin' | 'client'
  position?: string
  avatarUrl?: string
  clientId?: number
  client?: {
    id: number
    name: string
    industry?: string
  }
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ error: 'Authentication required' })
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  console.log('[requireAdmin] URL:', req.url, 'User:', req.user)
  if (req.isAuthenticated() && req.user?.role === 'admin') {
    console.log('[requireAdmin] Access granted')
    return next()
  }
  console.log('[requireAdmin] Access denied')
  res.status(403).json({ error: 'Admin access required' })
}

export const requireClient = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.role === 'client') {
    return next()
  }
  res.status(403).json({ error: 'Client access required' })
}

export const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.role && roles.includes(req.user.role)) {
    return next()
  }
  res.status(403).json({ error: 'Insufficient permissions' })
}