import { useState, useEffect, useCallback } from 'react'
import { Router, Route, Switch, useLocation } from 'wouter'
import { LoginPage } from './pages/LoginPage'
import { AdminLayout } from './components/AdminLayout'
import { ClientLayout } from './components/ClientLayout'
import { TeamMemberLayout } from './components/TeamMemberLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { api } from './lib/api'
import type { User } from './types/common'

// Helper component for catch-all redirect
function DefaultRedirect({ user }: { user: User }) {
  useEffect(() => {
    const defaultPath = user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'team_member'
        ? '/employee/dashboard'
        : '/client'

    const current = window.location.pathname
    if (!current.startsWith(defaultPath.split('/').slice(0, 2).join('/'))) {
      window.location.replace(defaultPath)
    }
  }, [user])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await api.getCurrentUser()
        setUser(currentUser)

        // Redirect to appropriate dashboard based on role if on wrong route
        if (currentUser) {
          const path = window.location.pathname
          if (path.startsWith('/admin') && currentUser.role !== 'admin') {
            const newPath = currentUser.role === 'team_member' ? '/employee/dashboard' : '/client/dashboard'
            window.location.href = newPath
          } else if (path.startsWith('/employee') && currentUser.role !== 'team_member') {
            const newPath = currentUser.role === 'admin' ? '/admin/dashboard' : '/client/dashboard'
            window.location.href = newPath
          } else if (path.startsWith('/client') && currentUser.role !== 'client') {
            const newPath = currentUser.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
            window.location.href = newPath
          }
        }
      } catch (error) {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Listen for login events
  useEffect(() => {
    const handleLogin = (event: Event) => {
      const customEvent = event as CustomEvent<User>
      setUser(customEvent.detail)
    }
    
    window.addEventListener('user-login', handleLogin)
    return () => window.removeEventListener('user-login', handleLogin)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  // Direct rendering based on path - bypassing wouter Router issues
  if (user.role === 'admin' && window.location.pathname.startsWith('/admin')) {
    return <AdminLayout user={user} />
  }

  if (user.role === 'client' && window.location.pathname.startsWith('/client')) {
    return (
      <ErrorBoundary>
        <ClientLayout user={user} />
      </ErrorBoundary>
    )
  }

  if (user.role === 'team_member' && window.location.pathname.startsWith('/employee')) {
    return <TeamMemberLayout user={user} />
  }

  // Default redirect based on role
  return <DefaultRedirect user={user} />
}

export default App