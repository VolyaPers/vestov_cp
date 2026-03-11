import { useState, useEffect } from 'react'
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Users2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const benefitCards = [
  {
    title: 'Operational clarity',
    text: 'Admin, employee and client workspaces now share a more deliberate information hierarchy.',
    icon: ShieldCheck,
  },
  {
    title: 'Faster navigation',
    text: 'Search, dashboards and contextual shortcuts reduce the time spent hunting for routine actions.',
    icon: Sparkles,
  },
  {
    title: 'Role-aware experience',
    text: 'Every entry path adapts to the access model you choose during account creation and sign-in.',
    icon: Users2,
  },
] as const

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

    if (googleSignup === '1') {
      const googleEmail = urlParams.get('email')
      const googleName = urlParams.get('name')
      const googleAvatar = urlParams.get('avatar')
      const googleId = urlParams.get('googleId')

      if (googleEmail && googleName) {
        const nameParts = googleName.trim().split(' ')
        const googleFirstName = nameParts[0] || ''
        const googleLastName = nameParts.slice(1).join(' ') || ''

        setEmail(googleEmail)
        setFirstName(googleFirstName)
        setLastName(googleLastName)
        setMode('register')
        setGoogleSignupData({
          googleId: googleId || undefined,
          avatarUrl: googleAvatar || undefined,
        })
        setError('Complete the remaining fields to finish your Google-based registration.')

        window.history.replaceState({}, '', window.location.pathname)
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
      window.history.replaceState({}, '', window.location.pathname)
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
      window.dispatchEvent(new CustomEvent('user-login', { detail: response.user }))
      onLogin(response.user)
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

      if (!googleSignupData) {
        registerData.password = password
      } else {
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

  const handleGoogleAuth = () => {
    if (import.meta.env.DEV) {
      window.location.href = 'http://localhost:3001/api/google'
      return
    }

    const googleOAuthUrl = import.meta.env.VITE_GOOGLE_OAUTH_URL
    if (googleOAuthUrl) {
      window.location.href = googleOAuthUrl
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL
    if (apiUrl) {
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/api`
      window.location.href = `${baseUrl}/google`
      return
    }

    window.location.href = '/api/google'
  }

  return (
    <div className="app-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 p-8 text-white shadow-[0_36px_80px_-36px_rgba(2,6,23,0.85)] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.18),transparent_26%),linear-gradient(135deg,rgba(15,23,42,1),rgba(15,118,110,0.92))]" />
          <div className="relative">
            <Badge className="bg-white/10 text-white hover:bg-white/15">Vestov Hub</Badge>
            <h1 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-tight text-white">
              One polished entry point for admin, client and employee workflows.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-200">
              The redesigned portal puts hierarchy, search and actionable status first, so people land inside the product already oriented.
            </p>
          </div>

          <div className="relative grid gap-4">
            {benefitCards.map(({ title, text, icon: Icon }) => (
              <div key={title} className="rounded-[1.5rem] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-white/10 text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">{text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Card className="w-full max-w-xl border-white/80 bg-white/86">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    Auth Portal
                  </Badge>
                  <CardTitle className="mt-4 text-3xl">Access your workspace</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">
                    Sign in to continue or create a role-based account in the updated Vestov Hub interface.
                  </CardDescription>
                </div>
              </div>

              <Tabs value={mode} onValueChange={(value) => setMode(value as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Create Account</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {mode === 'login' ? (
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
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
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
                      <div className="rounded-[1.2rem] border border-primary/15 bg-primary/10 p-4 text-sm text-primary">
                        You are registering with Google, so no password is required for this account.
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={role} onValueChange={(value) => setRole(value as 'admin' | 'client' | 'team_member')}>
                        <SelectTrigger id="role" disabled={isLoading}>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="team_member">Team Member</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {error && (
                  <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert" aria-live="polite">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                    : (mode === 'login' ? 'Sign In' : 'Create Account')}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-[0.68rem] uppercase tracking-[0.22em]">
                    <span className="bg-card px-3 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={handleGoogleAuth}
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

              <div className="mt-6 rounded-[1.2rem] border border-border/60 bg-muted/55 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Accounts redirect automatically into the correct workspace after authentication based on role.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
