import { User as PassportUser } from 'passport'

declare global {
  namespace Express {
    interface User extends PassportUser {
      id: number
      username: string
      fullName: string
      email: string
      role: 'admin' | 'client' | 'team_member' | string
      position?: string
      avatarUrl?: string
      clientId?: number
      teamMemberId?: number
    }

    interface Request {
      user?: User
      isAuthenticated?(): boolean
      logIn(user: User, callback: (err?: any) => void): void
      logout(callback: (err?: any) => void): void
      file?: Express.Multer.File
      files?: Express.Multer.File[]
    }
  }
}

export {}

