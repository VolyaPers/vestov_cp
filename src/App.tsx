import { useState, useEffect } from 'react'
import { Router, Route, Switch, Redirect } from 'wouter'
import { LoginPage } from './pages/LoginPage'
import { AdminLayout } from './components/AdminLayout'
import { ClientLayout } from './components/ClientLayout'
import { api } from './lib/api'

function App() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await api.getCurrentUser()
        setUser(currentUser)
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
    const handleLogin = (event: CustomEvent) => {
      setUser(event.detail)
    }
    
    window.addEventListener('user-login', handleLogin as EventListener)
    return () => window.removeEventListener('user-login', handleLogin as EventListener)
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

  return (
    <Router>
      <Switch>
        <Route path="/admin/*">
          {(params) => {
            console.log('App.tsx - admin route matched with params:', params)
            return user.role === 'admin' ? <AdminLayout user={user} /> : <div>Access denied</div>
          }}
        </Route>
        <Route path="/client/:path*">
          {user.role === 'client' ? <ClientLayout user={user} /> : <div>Access denied</div>}
        </Route>
        <Route>
          {() => {
            console.log('App.tsx - catch-all route triggered, redirecting to dashboard')
            return <Redirect to={user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard'} />
          }}
        </Route>
      </Switch>
    </Router>
  )
}

export default App