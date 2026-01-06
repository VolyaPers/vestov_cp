import { useState, useEffect } from 'react'
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

interface GoogleSignupData {
  googleId?: string
  avatarUrl?: string
}

interface RegisterRequestData {
  firstName: string
  lastName: string
  email: string
  role: 'admin' | 'client' | 'team_member'
  password?: string
  googleId?: string
  avatarUrl?: string
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
  const [googleSignupData, setGoogleSignupData] = useState<GoogleSignupData | null>(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    const errorMessage = urlParams.get('message')
    const googleSignup = urlParams.get('google_signup')
    
    // Handle Google signup flow
    if (googleSignup === '1') {
      const googleEmail = urlParams.get('email')
      const googleName = urlParams.get('name')
      const googleAvatar = urlParams.get('avatar')
      const googleId = urlParams.get('googleId')
      
      if (googleEmail && googleName) {
        // Parse name into first and last name
        const nameParts = googleName.trim().split(' ')
        const googleFirstName = nameParts[0] || ''
        const googleLastName = nameParts.slice(1).join(' ') || ''
        
        // Pre-fill form with Google data
        setEmail(googleEmail)
        setFirstName(googleFirstName)
        setLastName(googleLastName)
        setMode('register')
        setGoogleSignupData({
          googleId: googleId || undefined,
          avatarUrl: googleAvatar || undefined,
        })
        setError('Please complete your registration to create your account. Your Google account information has been pre-filled.')
        
        // Clean URL
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
      }
    }
    
    if (errorParam) {
      const defaultErrorMessages: Record<string, string> = {
        google_auth_error: 'Google authentication failed. Please try again or use email/password login.',
        google_auth_failed: 'Google authentication was unsuccessful. Please try again.',
        google_auth_inactive: 'Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.',
        google_auth_session_failed: 'Login session could not be established. Please try again.',
      }
      
      const displayMessage = errorMessage 
        ? decodeURIComponent(errorMessage)
        : defaultErrorMessages[errorParam] || 'An error occurred during authentication. Please try again.'
      
      setError(displayMessage)
      
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [])

  const redirectByRole = (userRole?: string) => {
    const target =
      userRole === 'admin'
        ? '/admin/dashboard'
        : userRole === 'team_member'
          ? '/employee/dashboard'
          : '/client/dashboard'
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
      const registerData: RegisterRequestData = {
        firstName,
        lastName,
        email,
        role,
      }
      
      // Only include password if not Google signup
      if (!googleSignupData) {
        registerData.password = password
      } else {
        // Include Google data for Google signup
        if (googleSignupData.googleId) {
          registerData.googleId = googleSignupData.googleId
        }
        if (googleSignupData.avatarUrl) {
          registerData.avatarUrl = googleSignupData.avatarUrl
        }
      }
      
      const response = await api.request('/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
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
                {!googleSignupData && (
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
                )}
                {googleSignupData && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                    You're registering with Google. No password needed - you'll sign in with Google in the future.
                  </div>
                )}
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
              <div className="text-red-600 text-sm text-center" role="alert" aria-live="polite">
                {error}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
          
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                if (import.meta.env.DEV) {
                  window.location.href = 'http://localhost:3001/api/google'
                } else {
                  const googleOAuthUrl = import.meta.env.VITE_GOOGLE_OAUTH_URL
                  if (googleOAuthUrl) {
                    window.location.href = googleOAuthUrl
                  } else {
                    const apiUrl = import.meta.env.VITE_API_URL
                    if (apiUrl) {
                      const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/api`
                      window.location.href = `${baseUrl}/google`
                    } else {
                      window.location.href = '/api/google'
                    }
                  }
                }
              }}
              disabled={isLoading}
              aria-label="Sign in with Google"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </Button>
          </div>
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