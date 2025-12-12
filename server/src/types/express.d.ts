import type { UserWithoutPassword, UserWithImpersonation } from './passport.js'

declare global {
  namespace Express {
    interface User extends UserWithoutPassword, Partial<UserWithImpersonation> {}

    interface Request {
      user?: User
      isAuthenticated?(): boolean
      logIn(user: User, callback: (err?: Error | null) => void): void
      logout(callback: (err?: Error | null) => void): void
      file?: Express.Multer.File
      files?: Express.Multer.File[]
    }
  }
}

export {}

