import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, User, UserCheck, UserX, Users, Shield, Briefcase, Search, Building, X, Settings, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'

interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: 'admin' | 'team_member' | 'client'
  position?: string
  avatarUrl?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

interface ClientAssignment {
  assignmentId: number
  clientId: number
  clientName: string
  accessLevel: 'read' | 'write' | 'admin'
  isActive: boolean
  assignedAt: string
}

interface UserWithClientAssignments extends User {
  clientAssignments?: ClientAssignment[]
}

export function UsersPage() {
  const [users, setUsers] = useState<UserWithClientAssignments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [isEditingUser, setIsEditingUser] = useState<User | null>(null)
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 'client' as 'admin' | 'team_member' | 'client',
    position: '',
    teamMemberId: '',
  })
  const [availableClients, setAvailableClients] = useState<Array<{id: number, name: string}>>([])
  const [availableTeamMembers, setAvailableTeamMembers] = useState<Array<{id: number, name: string, email: string, role: string}>>([])

  const [isClientAssignmentDialogOpen, setIsClientAssignmentDialogOpen] = useState(false)
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<UserWithClientAssignments | null>(null)
  const [assignmentFormData, setAssignmentFormData] = useState({
    clientId: '',
    accessLevel: 'read' as 'read' | 'write' | 'admin',
  })

  useEffect(() => {
    loadUsers()
    loadAvailableClients()
    loadAvailableTeamMembers()
  }, [])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const response = await api.getUsers({ search: searchTerm, role: roleFilter })
      const usersData = response.users || []

      // For each client user, load their client assignments
      const usersWithAssignments = await Promise.all(
        usersData.map(async (user) => {
          if (user.role === 'client') {
            try {
              const assignments = await api.getUser(user.id)
              return {
                ...user,
                clientAssignments: assignments.clientAssignments || []
              }
            } catch (error) {
              console.error(`Failed to load assignments for user ${user.id}:`, error)
              return { ...user, clientAssignments: [] }
            }
          }
          return user
        })
      )

      setUsers(usersWithAssignments)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailableClients = async () => {
    try {
      const response = await api.getClients()
      setAvailableClients(
        Array.isArray(response)
          ? response.map((client: { id: number; name: string }) => ({ id: client.id, name: client.name }))
          : []
      )
    } catch (error) {
      console.error('Failed to load clients:', error)
    }
  }

  const loadAvailableTeamMembers = async () => {
    try {
      const response = await api.getAvailableTeamMembers()
      setAvailableTeamMembers(response)
    } catch (error) {
      console.error('Failed to load available team members:', error)
    }
  }

  const handleSearch = () => {
    loadUsers()
  }

  const handleCreateUser = async () => {
    if (!userFormData.username || !userFormData.fullName || !userFormData.email) {
      alert('Please fill in all required fields')
      return
    }

    // teamMemberId is optional - user can be created without linking to a team member
    // They can be linked later from the Team page

    try {
      const payload: {
        username: string
        password?: string
        fullName: string
        email: string
        role: 'admin' | 'team_member' | 'client'
        position?: string
        teamMemberId?: number
      } = {
        username: userFormData.username,
        fullName: userFormData.fullName,
        email: userFormData.email,
        role: userFormData.role,
      }
      if (userFormData.password) payload.password = userFormData.password
      if (userFormData.position) payload.position = userFormData.position
      if (userFormData.teamMemberId) {
        payload.teamMemberId = parseInt(userFormData.teamMemberId)
      }
      const result = await api.createUser(payload)
      
      // Only proceed if we got a valid user back
      if (!result || !result.id) {
        throw new Error('User creation failed: No user data returned')
      }
      
      await loadUsers()
      await loadAvailableTeamMembers() // Refresh available team members
      setIsUserDialogOpen(false)
      resetUserForm()
      alert('User created successfully.')
    } catch (error) {
      console.error('Failed to create user:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user'
      alert(errorMessage)
      // Don't close dialog or reset form on error
      return
    }
  }

  const handleEditUser = (user: User) => {
    setIsEditingUser(user)
    setUserFormData({
      username: user.username,
      password: '', // Don't prefill password for security
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      position: user.position || '',
      teamMemberId: '',
    })
    setIsUserDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!isEditingUser || !userFormData.username || !userFormData.fullName || !userFormData.email) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const updateData: {
        username: string
        fullName: string
        email: string
        role: 'admin' | 'team_member' | 'client'
        position?: string
        password?: string
      } = {
        username: userFormData.username,
        fullName: userFormData.fullName,
        email: userFormData.email,
        role: userFormData.role,
      }
      if (userFormData.position) updateData.position = userFormData.position
      if (userFormData.password && userFormData.password.trim() !== '') {
        updateData.password = userFormData.password
      }

      await api.updateUser(isEditingUser.id, updateData)


      await loadUsers()
      setIsUserDialogOpen(false)
      resetUserForm()
      alert('User updated successfully!')
    } catch (error) {
      console.error('Failed to update user:', error)
      alert(error instanceof Error ? error.message : 'Failed to update user')
    }
  }

  const handleToggleUserStatus = async (user: User) => {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive })
      await loadUsers()
      alert(`User ${user.isActive ? 'deactivated' : 'activated'} successfully!`)
    } catch (error) {
      console.error('Failed to toggle user status:', error)
      alert(error instanceof Error ? error.message : 'Failed to update user status')
    }
  }

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`Delete user "${user.fullName}" and all associated records? This cannot be undone.`)
    if (!confirmed) return
    try {
      await api.deleteUserHard(user.id)
      await loadUsers()
      await loadAvailableTeamMembers()
      alert('User deleted successfully')
    } catch (error) {
      console.error('Failed to delete user:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete user')
    }
  }

  const resetUserForm = () => {
    setUserFormData({
      username: '',
      password: '',
      fullName: '',
      email: '',
      role: 'client',
      position: '',
      teamMemberId: '',
    })
    setIsEditingUser(null)
  }

  const handleManageClientAssignment = (user: UserWithClientAssignments) => {
    setSelectedUserForAssignment(user)
    setAssignmentFormData({
      clientId: '',
      accessLevel: 'read',
    })
    setIsClientAssignmentDialogOpen(true)
  }

  const handleAssignToClient = async () => {
    if (!selectedUserForAssignment || !assignmentFormData.clientId) {
      alert('Please select a client')
      return
    }

    try {
      await api.assignUserToClient(
        selectedUserForAssignment.id,
        Number(assignmentFormData.clientId),
        {
          accessLevel: assignmentFormData.accessLevel,
          assignedBy: 1
        }
      )

      await loadUsers()
      setIsClientAssignmentDialogOpen(false)
      setSelectedUserForAssignment(null)
      alert('User assigned to client successfully!')
    } catch (error) {
      console.error('Failed to assign user to client:', error)
      alert(error instanceof Error ? error.message : 'Failed to assign user to client')
    }
  }

  const handleRemoveFromClient = async (userId: number, clientId: number, clientName: string) => {
    if (!confirm(`Remove user from "${clientName}"?`)) {
      return
    }

    try {
      await api.removeUserFromClient(userId, clientId)
      await loadUsers()
      alert('User removed from client successfully!')
    } catch (error) {
      console.error('Failed to remove user from client:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove user from client')
    }
  }

  const handleUpdateClientAccess = async (userId: number, clientId: number, newAccessLevel: 'read' | 'write' | 'admin') => {
    try {
      await api.updateClientAssignment(userId, clientId, { accessLevel: newAccessLevel })
      await loadUsers()
      alert('Access level updated successfully!')
    } catch (error) {
      console.error('Failed to update access level:', error)
      alert(error instanceof Error ? error.message : 'Failed to update access level')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />
      case 'team_member':
        return <Briefcase className="h-4 w-4" />
      case 'client':
        return <User className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'team_member':
        return 'bg-blue-100 text-blue-800'
      case 'client':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === '' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage system users and their roles</p>
        </div>
        <Button onClick={() => setIsUserDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <Input
                id="search"
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-48">
              <Label htmlFor="roleFilter">Filter by Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="team_member">Team Member</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            All system users with their roles and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id ?? `${user.username}-${user.email}`} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {getRoleIcon(user.role)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{user.fullName}</p>
                          <Badge className={getRoleBadgeClass(user.role)}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                          {!user.isActive && (
                            <Badge variant="outline" className="text-red-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span>@{user.username}</span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                          {user.position && <span>{user.position}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.role === 'client' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageClientAssignment(user)}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors duration-200"
                          title="Manage client assignments"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleUserStatus(user)}
                        className={user.isActive 
                          ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50 hover:border-orange-300 transition-colors duration-200" 
                          : "text-green-600 hover:text-green-700 hover:bg-green-50 hover:border-green-300 transition-colors duration-200"}
                        title={user.isActive ? "Deactivate user" : "Activate user"}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors duration-200"
                        title="Delete user permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Client Assignments Section */}
                  {user.role === 'client' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Client Assignments
                        </h4>
                      </div>
                      {user.clientAssignments && user.clientAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {user.clientAssignments.map((assignment) => (
                            <div
                              key={assignment.assignmentId ?? `${assignment.clientId}-${assignment.assignedAt ?? assignment.clientName}`}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{assignment.clientName}</span>
                                  <Badge className={
                                    assignment.accessLevel === 'admin' ? 'bg-red-100 text-red-800' :
                                    assignment.accessLevel === 'write' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }>
                                    {assignment.accessLevel}
                                  </Badge>
                                  {!assignment.isActive && (
                                    <Badge variant="outline" className="text-red-600">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Select
                                  value={assignment.accessLevel}
                                  onValueChange={(value: 'read' | 'write' | 'admin') =>
                                    handleUpdateClientAccess(user.id, assignment.clientId, value)
                                  }
                                >
                                  <SelectTrigger className="w-20 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="read">Read</SelectItem>
                                    <SelectItem value="write">Write</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveFromClient(user.id, assignment.clientId, assignment.clientName)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  title="Remove from client"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-2 text-gray-500 text-sm">
                          <Building className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                          <p>No client assignments</p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleManageClientAssignment(user)}
                            className="text-primary text-xs"
                          >
                            Assign to client
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-2 border-t">
                    <span>Created: {new Date(user.createdAt).toLocaleDateString()}</span>
                    {user.lastLoginAt && (
                      <span>Last login: {new Date(user.lastLoginAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Users Found</h3>
              <p>No users match your search criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditingUser ? `Edit User: ${isEditingUser.fullName}` : 'Create New User'}
            </DialogTitle>
            <DialogDescription>
              {isEditingUser ? 'Update user information and role.' : 'Create a new user account with a specific role.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userUsername">Username *</Label>
                <Input
                  id="userUsername"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  placeholder="johndoe"
                />
              </div>
              <div>
                <Label htmlFor="userPassword">
                  Password (optional)
                </Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="********"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="userFullName">Full Name *</Label>
              <Input
                id="userFullName"
                value={userFormData.fullName}
                onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="userEmail">Email *</Label>
              <Input
                id="userEmail"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userRole">Role *</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={(value: 'admin' | 'team_member' | 'client') =>
                    setUserFormData({ ...userFormData, role: value, teamMemberId: value === 'team_member' ? userFormData.teamMemberId : '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="team_member">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Team Member
                      </div>
                    </SelectItem>
                    <SelectItem value="client">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Client
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="userPosition">Position</Label>
                <Input
                  id="userPosition"
                  value={userFormData.position}
                  onChange={(e) => setUserFormData({ ...userFormData, position: e.target.value })}
                  placeholder="Project Manager"
                />
              </div>
            </div>

            {/* Team Member Selection - Only show when role is team_member */}
            {userFormData.role === 'team_member' && !isEditingUser && (
              <div>
                <Label htmlFor="teamMember">Link to Team Member (Optional)</Label>
                <Select
                  value={userFormData.teamMemberId || ''}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      setUserFormData({ ...userFormData, teamMemberId: '' })
                    } else {
                      setUserFormData({ ...userFormData, teamMemberId: value })
                      // Auto-fill email from selected team member
                      const selectedTm = availableTeamMembers.find(tm => tm.id.toString() === value)
                      if (selectedTm) {
                        setUserFormData(prev => ({ ...prev, email: selectedTm.email, fullName: selectedTm.name, teamMemberId: value }))
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team member (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-gray-500">None - Create without linking</span>
                    </SelectItem>
                    {availableTeamMembers.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No available team members (all have accounts)</div>
                    ) : (
                      availableTeamMembers.map(tm => (
                        <SelectItem key={tm.id} value={tm.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{tm.name}</span>
                            <span className="text-xs text-gray-500">{tm.email} - {tm.role}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Select an existing team member to link, or leave empty to create without linking. 
                  You can link this user to a team member later from the Team page.
                </p>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
              <p><strong>Role Descriptions:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Admin:</strong> Full system access, can manage all users and clients</li>
                <li><strong>Team Member:</strong> Internal staff with access to admin features</li>
                <li><strong>Client:</strong> External users who can be assigned to client portals</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUserDialogOpen(false)
                resetUserForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={isEditingUser ? handleUpdateUser : handleCreateUser}>
              {isEditingUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Assignment Dialog */}
      <Dialog open={isClientAssignmentDialogOpen} onOpenChange={setIsClientAssignmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Client Assignment</DialogTitle>
            <DialogDescription>
              Assign "{selectedUserForAssignment?.fullName}" to a client portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="assignClient">Select Client</Label>
              <Select
                value={assignmentFormData.clientId}
                onValueChange={(value) => setAssignmentFormData({ ...assignmentFormData, clientId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client to assign" />
                </SelectTrigger>
                <SelectContent>
                  {availableClients
                    .filter(client => !selectedUserForAssignment?.clientAssignments?.some(assignment => assignment.clientId === client.id))
                    .map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignAccessLevel">Access Level</Label>
              <Select
                value={assignmentFormData.accessLevel}
                onValueChange={(value: 'read' | 'write' | 'admin') =>
                  setAssignmentFormData({ ...assignmentFormData, accessLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read - View only access</SelectItem>
                  <SelectItem value="write">Write - Can view and edit</SelectItem>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedUserForAssignment?.clientAssignments && selectedUserForAssignment.clientAssignments.length > 0 && (
              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                <p><strong>Current Assignments:</strong></p>
                <ul className="list-disc list-inside mt-1">
                  {selectedUserForAssignment.clientAssignments.map((assignment) => (
                    <li key={assignment.assignmentId ?? `${assignment.clientId}-${assignment.accessLevel}`}>
                      {assignment.clientName} ({assignment.accessLevel})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsClientAssignmentDialogOpen(false)
                setSelectedUserForAssignment(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignToClient}>
              Assign to Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}