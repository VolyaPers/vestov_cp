import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

interface LoginPageProps {
  onLogin: (user: any) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await api.login(username, password)
      onLogin(response.user)
      window.dispatchEvent(new CustomEvent('user-login', { detail: response.user }))

      // Redirect immediately based on role to avoid stuck loading
      const role = response.user?.role
      const target =
        role === 'admin' ? '/admin/dashboard' :
        role === 'team_member' ? '/employee/dashboard' :
        '/client'
      window.location.href = target
    } catch (error: any) {
      setError(error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLogin()
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
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
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
            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
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