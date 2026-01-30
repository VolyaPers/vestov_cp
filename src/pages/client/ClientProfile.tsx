import { useState, useEffect } from 'react'
import { User, Mail, Phone, MapPin, Building, Calendar, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface UserProfile {
  id: number
  username: string
  fullName: string
  email: string
  role: string
  position?: string
  avatarUrl?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

interface ClientInfo {
  id: number
  name: string
  industry?: string
  status: string
  contractType?: string
}

export function ClientProfile() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [assignedClients, setAssignedClients] = useState<ClientInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        // Load current user profile
        const currentUser = await api.getCurrentUser()
        setUser(currentUser)

        // Load assigned clients
        const clients = await api.getClients()
        setAssignedClients(clients)
      } catch (error) {
        console.error('Failed to load profile data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfileData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Profile Not Found</h2>
        <p className="mt-2 text-gray-600">Unable to load your profile information.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Profile
            </h1>
            <p className="stripe-text-secondary text-lg">
              Your account information and client access
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{user.fullName}</h3>
                <p className="text-sm text-gray-600">@{user.username}</p>
                <Badge className="mt-1 bg-blue-100 text-blue-800 capitalize">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-900">{user.email}</span>
              </div>

              {user.position && (
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{user.position}</span>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-900">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>

              {user.lastLoginAt && (
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Client Access
            </CardTitle>
            <CardDescription>Clients you have access to</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedClients.length > 0 ? (
              <div className="space-y-3">
                {assignedClients.map((client) => (
                  <div key={client.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{client.name}</h4>
                      <Badge className={
                        client.status === 'active' ? 'bg-green-100 text-green-800' :
                        client.status === 'inactive' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {client.status}
                      </Badge>
                    </div>
                    {client.industry && (
                      <p className="text-sm text-gray-600 mb-2">{client.industry}</p>
                    )}
                    {client.contractType && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {client.contractType}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-600">No client access assigned</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Status
            </CardTitle>
            <CardDescription>Your current account permissions and limitations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-900">Account Active</p>
                <p className="text-xs text-green-600 mt-1">Full access enabled</p>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-blue-900">Client Role</p>
                <p className="text-xs text-blue-600 mt-1">Read-only access</p>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Building className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-purple-900">Multi-Client</p>
                <p className="text-xs text-purple-600 mt-1">{assignedClients.length} client{assignedClients.length !== 1 ? 's' : ''} assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}