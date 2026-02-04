import { useState, useEffect } from 'react'
import { Users, X, ChevronDown, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
      <div className="stripe-card p-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs stripe-text-muted mb-1">Impersonating</div>
            <div className="text-sm font-medium stripe-text-primary">{currentUser.fullName}</div>
            <div className="text-xs stripe-text-secondary">{currentUser.email}</div>
          </div>
          <Button
            size="sm"
            onClick={handleStopImpersonation}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
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
    <div className="stripe-card p-3 mb-4">
      <div className="text-xs stripe-text-muted mb-2">Super Admin</div>

      {!showDropdown ? (
        <Button
          size="sm"
          onClick={() => setShowDropdown(true)}
          className="w-full stripe-btn-primary"
          variant="outline"
          title="Impersonate another user"
        >
          <Users className="w-4 h-4 mr-2" />
          Switch to User
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium stripe-text-primary mb-2">Select User:</div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleImpersonate(user.id)}
                disabled={loading}
                className="w-full text-left p-2 rounded-lg hover:bg-gray-100 stripe-text-primary text-sm transition-colors"
              >
                <div className="font-medium">{user.fullName}</div>
                <div className="text-xs stripe-text-secondary">{user.email}</div>
                <div className="text-xs stripe-text-muted capitalize">{user.role}</div>
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => setShowDropdown(false)}
            variant="outline"
            className="w-full"
            title="Cancel user selection"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
