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

interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: string
}

interface UserImpersonationProps {
  currentUser: any
  onImpersonate: (userId: number) => void
  onStopImpersonation: () => void
}

export function UserImpersonation({ currentUser, onImpersonate, onStopImpersonation }: UserImpersonationProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        // API returns { users: [...], pagination: {...} }
        const allUsers = data.users || data
        setUsers(allUsers.filter((u: User) => u.id !== currentUser?.id))
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const handleImpersonate = async (userId: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/impersonate/${userId}`, {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      const data = await response.json()
      await onImpersonate(userId)
      setShowDropdown(false)

      // Redirect to appropriate portal based on impersonated user's role
      const targetRole = data.user.role
      const redirectPath = targetRole === 'admin' ? '/admin/dashboard' :
                          targetRole === 'team_member' ? '/employee/dashboard' :
                          '/client/portal'

      console.log('Impersonation successful, redirecting to:', redirectPath)
      window.location.href = redirectPath
    } catch (error: any) {
      console.error('Error impersonating user:', error)
      alert(error.message || 'Failed to impersonate user')
    } finally {
      setLoading(false)
    }
  }

  const handleStopImpersonation = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stop-impersonation', {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to stop impersonation')
      }

      const data = await response.json()
      await onStopImpersonation()

      // Redirect back to admin dashboard (original user should be admin)
      const targetRole = data.user.role
      const redirectPath = targetRole === 'admin' ? '/admin/dashboard' :
                          targetRole === 'team_member' ? '/employee/dashboard' :
                          '/client/portal'

      console.log('Stop impersonation successful, redirecting to:', redirectPath)
      window.location.href = redirectPath
    } catch (error) {
      console.error('Error stopping impersonation:', error)
      alert('Failed to stop impersonation')
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
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
