import { Request, Response, NextFunction } from 'express'

export interface AuthenticatedUser {
  id: number
  username: string
  fullName: string
  email: string
  role: 'admin' | 'client' | 'team_member'
  position?: string
  avatarUrl?: string
  clientId?: number
  teamMemberId?: number
  isActive?: boolean
  client?: {
    id: number
    name: string
    industry?: string
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.isActive !== false) {
    return next()
  }
  res.status(401).json({ error: 'Authentication required' })
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.isActive !== false && req.user?.role === 'admin') {
    return next()
  }
  res.status(403).json({ error: 'Admin access required' })
}

export const requireClient = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.isActive !== false && req.user?.role === 'client') {
    return next()
  }
  res.status(403).json({ error: 'Client access required' })
}

export const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user?.isActive !== false && req.user?.role && roles.includes(req.user.role)) {
    return next()
  }
  res.status(403).json({ error: 'Insufficient permissions' })
}