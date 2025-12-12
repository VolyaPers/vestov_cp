export interface UserWithPassword {
  id: number
  username: string
  password: string
  fullName: string
  email: string
  role: string
  position?: string | null
  avatarUrl?: string | null
  isActive?: boolean | null
  teamMemberId?: number | null
}

export interface UserWithoutPassword extends Omit<UserWithPassword, 'password'> {}

export interface SessionData {
  id: number
  originalUserId?: number
  originalUsername?: string
  originalEmail?: string
}

export interface UserWithImpersonation extends UserWithoutPassword {
  originalUserId?: number
  originalUsername?: string
  originalEmail?: string
}

