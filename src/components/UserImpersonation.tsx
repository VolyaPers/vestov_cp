import { useState, useEffect } from 'react'
import { Users, X, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types/common'
import { api } from '@/lib/api'
import { useCustomAlert } from '@/components/ui/custom-alert'

interface UserImpersonationProps {
  currentUser: User | null
  onImpersonate: (userId: number) => void
  onStopImpersonation: () => void
}

export function UserImpersonation({ currentUser, onImpersonate, onStopImpersonation }: UserImpersonationProps) {
  const { showAlert } = useCustomAlert()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (showDropdown) {
      loadUsers()
    }
  }, [showDropdown, currentUser?.id])

  const loadUsers = async () => {
    try {
      const response = await api.getUsers({ limit: 1000 })
      
      // Handle different response formats
      let allUsers: User[] = []
      if (Array.isArray(response)) {
        allUsers = response
      } else if (response?.users && Array.isArray(response.users)) {
        allUsers = response.users
      } else if (response && typeof response === 'object') {
        allUsers = []
      }

      // Filter users: exclude current user and only include explicitly active users
      // Only show users where isActive is explicitly true
      const filteredUsers = allUsers
        .filter((u) => u.id !== currentUser?.id)
        .filter((u) => u.isActive === true)

      setUsers(filteredUsers)
    } catch (error) {
      console.error('[UserImpersonation] Error loading users:', error)
      // Show user-friendly error message
      if (error instanceof Error) {
        console.error('[UserImpersonation] Error details:', error.message, error.stack)
      }
      setUsers([]) // Set empty array on error to prevent UI issues
    }
  }

  const handleImpersonate = async (userId: number) => {
    try {
      setLoading(true)
      const data = await api.request(`/impersonate/${userId}`, {
        method: 'POST'
      })
      
      await onImpersonate(userId)
      setShowDropdown(false)

      // Redirect to appropriate portal based on impersonated user's role
      const targetRole = data.user?.role
      const redirectPath = targetRole === 'admin' ? '/admin/dashboard' :
                          targetRole === 'team_member' ? '/employee/dashboard' :
                          '/client/portal'

      window.location.href = redirectPath
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to impersonate user'
      console.error('[UserImpersonation] Error impersonating user:', error)
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleStopImpersonation = async () => {
    try {
      setLoading(true)
      const data = await api.request('/stop-impersonation', {
        method: 'POST'
      })
      
      await onStopImpersonation()

      // Redirect back to admin dashboard (original user should be admin)
      const targetRole = data.user?.role
      const redirectPath = targetRole === 'admin' ? '/admin/dashboard' :
                          targetRole === 'team_member' ? '/employee/dashboard' :
                          '/client/portal'

      window.location.href = redirectPath
    } catch (error) {
      console.error('Error stopping impersonation:', error)
      showAlert({ message: 'Failed to stop impersonation', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Only show for admins (either currently admin or impersonating from an admin)
  const isAdminContext =
    currentUser?.role === 'admin' ||
    !!currentUser?.originalUser

  if (!isAdminContext) {
    return null
  }

  // Show stop impersonation button if currently impersonating
  if (currentUser?.isImpersonating) {
    return (
      <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50/80 p-4 shadow-[0_16px_28px_-24px_rgba(217,119,6,0.35)]">
        <div className="space-y-4">
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">Impersonating</Badge>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Admin override</span>
            </div>
            <div className="text-sm font-semibold text-foreground">{currentUser.fullName}</div>
            <div className="mt-1 text-xs text-muted-foreground">{currentUser.email}</div>
          </div>
          <Button
            size="sm"
            onClick={handleStopImpersonation}
            disabled={loading}
            className="w-full justify-center bg-amber-600 text-white hover:bg-amber-700"
            title="Stop impersonating and return to your account"
          >
            <LogOut className="w-4 h-4 mr-1" />
            {loading ? 'Stopping...' : 'Stop'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[1.1rem] border border-white/80 bg-white/75 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
      {!showDropdown ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-primary/10 text-primary">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Admin impersonation</div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowDropdown(true)}
            className="w-full justify-center"
            title="Impersonate another user"
          >
            <Users className="mr-2 h-4 w-4" />
            Switch to User
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">Select user</div>
            <Button
              size="sm"
              onClick={() => setShowDropdown(false)}
              variant="outline"
              className="h-8 px-2"
              title="Cancel user selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleImpersonate(user.id)}
                disabled={loading}
                className="w-full rounded-[1rem] border border-border/60 bg-white/70 px-3.5 pb-3.5 pt-3 text-left text-sm transition-colors hover:border-primary/25 hover:bg-primary/5"
              >
                <div className="font-medium text-foreground">{user.fullName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
                <div className="mt-1 text-xs capitalize text-primary">{user.role}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
