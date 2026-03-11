import { useState, useEffect, useCallback } from 'react'
import { Router, Route, Switch, useLocation } from 'wouter'
import { LoginPage } from './pages/LoginPage'
import { AdminLayout } from './components/AdminLayout'
import { ClientLayout } from './components/ClientLayout'
import { TeamMemberLayout } from './components/TeamMemberLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { GlobalSearch } from './components/GlobalSearch'
import { api } from './lib/api'
import type { User } from './types/common'

// Helper component for catch-all redirect
function DefaultRedirect({ user }: { user: User }) {
  useEffect(() => {
    const defaultPath = user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'team_member'
        ? '/employee/dashboard'
        : '/client/dashboard'

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
      const url = new URL(window.location.href)
      const authToken = url.searchParams.get('auth_token')

      try {
        if (authToken) {
          const response = await api.request('/auth/exchange', {
            method: 'POST',
            body: JSON.stringify({ token: authToken }),
          })

          const nextUrl = new URL(window.location.href)
          nextUrl.searchParams.delete('auth_token')
          window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)

          setUser(response.user)
          return
        }

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
        if (authToken) {
          const nextUrl = new URL(window.location.href)
          nextUrl.searchParams.delete('auth_token')
          nextUrl.searchParams.set('error', 'google_auth_session_failed')
          window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
        }
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
    return <LoginPage onLogin={(u: User) => setUser(u)} />
  }

  const withSearch = (content: JSX.Element) => (
    <>
      {content}
      <GlobalSearch user={user} />
    </>
  )

  // Direct rendering based on path - bypassing wouter Router issues
  if (user.role === 'admin' && window.location.pathname.startsWith('/admin')) {
    return withSearch(<AdminLayout user={user} />)
  }

  if (user.role === 'client' && window.location.pathname.startsWith('/client')) {
    return withSearch(
      <ErrorBoundary>
        <ClientLayout user={user} />
      </ErrorBoundary>
    )
  }

  if (user.role === 'team_member' && window.location.pathname.startsWith('/employee')) {
    return withSearch(<TeamMemberLayout user={user} />)
  }

  // Default redirect based on role
  return withSearch(<DefaultRedirect user={user} />)
}

export default App
