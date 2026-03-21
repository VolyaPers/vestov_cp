import { useAuth } from '@clerk/react'
import { api } from '@/lib/api'

export function useAppSignOut() {
  const { signOut } = useAuth()

  return async () => {
    try {
      await api.logout()
    } catch {
      // The backend session may already be gone. Clerk sign-out should still continue.
    }

    try {
      await signOut()
    } finally {
      window.location.assign('/')
    }
  }
}
