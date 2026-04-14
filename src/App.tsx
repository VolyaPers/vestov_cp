import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/react'
import { AdminLayout } from './components/AdminLayout'
import { ClientLayout } from './components/ClientLayout'
import { TeamMemberLayout } from './components/TeamMemberLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { GlobalSearch } from './components/GlobalSearch'
import { AuthPage } from './pages/AuthPage'
import { api } from './lib/api'
import { WorkspaceShellSkeleton } from './components/page-primitives'
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
    <WorkspaceShellSkeleton roleLabel="Workspace" title="Connecting workspace" />
  )
}

function App() {
  const { getToken, isLoaded: isClerkLoaded, isSignedIn } = useAuth()
  const { user: clerkUser } = useUser()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const syncAuthenticatedUser = async () => {
      if (!isClerkLoaded) {
        return
      }

      if (!isSignedIn) {
        setUser(null)
        setAuthError(null)
        setIsLoading(false)

        api.logout().catch(() => {
          // If the legacy session is already gone, there is nothing left to clear.
        })
        return
      }

      setIsLoading(true)
      setAuthError(null)

      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase()

      try {
        let currentUser = await api.getCurrentUser()
        const sessionBelongsToSignedInClerkUser = currentUser
          ? [currentUser.email, currentUser.originalUser?.email]
              .filter((value): value is string => Boolean(value))
              .some((value) => !clerkEmail || value.toLowerCase() === clerkEmail)
          : false

        const needsSessionSync = !currentUser || !sessionBelongsToSignedInClerkUser

        if (needsSessionSync) {
          if (currentUser) {
            await api.logout().catch(() => {
              // A stale backend session should not block Clerk from re-establishing access.
            })
          }

          const token = await getToken()
          if (!token) {
            throw new Error('Clerk did not return a usable session token.')
          }

          const response = await api.syncClerkSession(token)
          currentUser = response.user
        }

        if (!currentUser) {
          throw new Error('Unable to establish a Vestov Hub session for this Clerk account.')
        }

        if (!isActive) {
          return
        }

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
        if (!isActive) {
          return
        }

        setUser(null)
        setAuthError(error instanceof Error ? error.message : 'Unable to connect this Clerk account to Vestov Hub.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    syncAuthenticatedUser()

    return () => {
      isActive = false
    }
  }, [clerkUser?.id, clerkUser?.primaryEmailAddress?.emailAddress, getToken, isClerkLoaded, isSignedIn])

  if (!isClerkLoaded || isLoading) {
    return <WorkspaceShellSkeleton roleLabel="Workspace" title="Loading your workspace" />
  }

  if (!isSignedIn || !user) {
    return <AuthPage errorMessage={authError} />
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
