import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: string
}

interface LoginPageProps {
  onLogin: (user: User) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'client' | 'team_member'>('client')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const redirectByRole = (userRole?: string) => {
    const target =
      userRole === 'admin'
        ? '/admin/dashboard'
        : userRole === 'team_member'
          ? '/employee/dashboard'
          : '/client'
    window.location.href = target
  }

  const handleLogin = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await api.login(username, password)
      onLogin(response.user)
      window.dispatchEvent(new CustomEvent('user-login', { detail: response.user }))

      // Redirect immediately based on role to avoid stuck loading
      redirectByRole(response.user?.role)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role,
        }),
      })
      onLogin(response.user)
      window.dispatchEvent(new CustomEvent('user-login', { detail: response.user }))
      redirectByRole(response.user?.role)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      handleLogin()
    } else {
      handleRegister()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Vestov Client Portal</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === 'login' ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setMode('login')}
                disabled={isLoading}
              >
                Sign In
              </Button>
              <Button
                type="button"
                variant={mode === 'register' ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setMode('register')}
                disabled={isLoading}
              >
                Create Account
              </Button>
            </div>

            {mode === 'login' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username or Email</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'client' | 'team_member')}
                    disabled={isLoading}
                  >
                    <option value="admin">Admin</option>
                    <option value="team_member">Team Member</option>
                    <option value="client">Client</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
          <div className="mt-6 text-sm text-gray-600">
            <p className="font-semibold text-center mb-2">Demo Credentials:</p>
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="font-medium text-gray-700">Admin:</span>
                <span className="text-gray-900">admin / admin123</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="font-medium text-gray-700">Client:</span>
                <span className="text-gray-900">client / client123</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Employee:</span>
                <span className="text-gray-900">eduardo / eduardo123</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}