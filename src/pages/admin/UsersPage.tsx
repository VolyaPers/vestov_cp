import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { Plus, Edit, Trash2, User, Mail, UserCheck, UserX, Users, Shield, Briefcase, Search, Building, X, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { TimezoneSelect } from '@/components/TimezoneSelect'
import { CardSkeleton, EmptyState, MetricTile, MetricTileSkeleton, PageHero, PageHeroSkeleton, SectionHeading, TableSkeleton } from '@/components/page-primitives'

interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: 'admin' | 'team_member' | 'client'
  position?: string
  timezone?: string
  avatarUrl?: string
  clerkUserId?: string | null
  authProvider?: string | null
  teamMemberId?: number
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
  const [location] = useLocation()
  const { showAlert, showConfirm } = useCustomAlert()
  const [users, setUsers] = useState<UserWithClientAssignments[]>([])
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [invitationUrl, setInvitationUrl] = useState('')
  const [invitingUser, setInvitingUser] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [roleFilter, setRoleFilter] = useState('')
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [isEditingUser, setIsEditingUser] = useState<User | null>(null)
  const [userFormData, setUserFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    role: 'client' as 'admin' | 'team_member' | 'client',
    position: '',
    timezone: '',
  })
  const [availableClients, setAvailableClients] = useState<Array<{id: number, name: string}>>([])

  const [isClientAssignmentDialogOpen, setIsClientAssignmentDialogOpen] = useState(false)
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<UserWithClientAssignments | null>(null)
  const [assignmentFormData, setAssignmentFormData] = useState({
    clientId: '',
    accessLevel: 'read' as 'read' | 'write' | 'admin',
  })

  useEffect(() => {
    loadAvailableClients()
  }, [])

  useEffect(() => {
    const nextQuery = new URLSearchParams(window.location.search).get('q') ?? ''
    setSearchTerm(nextQuery)
    loadUsers(nextQuery, roleFilter)
  }, [location])

  const loadUsers = async (nextSearchTerm = searchTerm, nextRoleFilter = roleFilter, nextPage = 1) => {
    try {
      setIsLoading(true)
      setLoadError('')
      const response = await api.getUsers({ search: nextSearchTerm, role: nextRoleFilter, page: nextPage, limit: 50 })
      setPage(nextPage)
      setPages(response.pagination?.pages || 1)
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
              setLoadError('Some client assignments could not be loaded. Please retry.')
              return { ...user, clientAssignments: [] }
            }
          }
          return user
        })
      )

      setUsers(usersWithAssignments)
    } catch (error) {
      setLoadError('Unable to load users. Please retry.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAvailableClients = async () => {
    try {
      const response = await api.getClients()
      setAvailableClients(response.map((client: any) => ({ id: client.id, name: client.name })))
    } catch (error) {
      setLoadError('Unable to load available clients. Please reload before assigning access.')
    }
  }

  const handleSearch = () => {
    loadUsers(searchTerm, roleFilter)
  }

  const handleCreateUser = async () => {
    if (!userFormData.username || !userFormData.fullName || !userFormData.email) {
      await showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      setIsSaving(true)
      await api.createUser(userFormData)

      // Clear filters to ensure new user is visible
      setSearchTerm('')
      setRoleFilter('')

      await loadUsers()
      setIsUserDialogOpen(false)
      resetUserForm()
      await showAlert({ message: 'Internal access created. Link an employee profile or assign client access, then generate a Clerk invitation link.', type: 'success' })
    } catch (error: any) {
      console.error('Failed to create user:', error)
      await showAlert({ message: error.message || 'Failed to create user', type: 'error' })
    } finally { setIsSaving(false) }
  }

  const handleEditUser = (user: User) => {
    setIsEditingUser(user)
    setUserFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      position: user.position || '',
      timezone: user.timezone || '',
    })
    setIsUserDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!isEditingUser || !userFormData.username || !userFormData.fullName || !userFormData.email) {
      await showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      const updateData: any = {
        username: userFormData.username,
        fullName: userFormData.fullName,
        email: userFormData.email,
        role: userFormData.role,
        position: userFormData.position || undefined,
        timezone: userFormData.timezone || undefined,
      }

      setIsSaving(true)
      await api.updateUser(isEditingUser.id, updateData)

      await loadUsers()
      setIsUserDialogOpen(false)
      resetUserForm()
      await showAlert({ message: 'User updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update user:', error)
      await showAlert({ message: error.message || 'Failed to update user', type: 'error' })
    } finally { setIsSaving(false) }
  }

  const handleToggleUserStatus = async (user: User) => {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive })
      await loadUsers()
      await showAlert({ message: `User ${user.isActive ? 'deactivated' : 'activated'} successfully!`, type: 'success' })
    } catch (error: any) {
      console.error('Failed to toggle user status:', error)
      await showAlert({ message: error.message || 'Failed to update user status', type: 'error' })
    }
  }

  const handleDeleteUserPermanently = async (user: User) => {
    const confirmed = await showConfirm({
      title: 'Delete User Permanently',
      message: `Remove the unused account "${user.fullName}"? Only an unlinked account with no history or related records can be removed. Other accounts must be deactivated to preserve their records.`,
      type: 'error',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.deleteUserHard(user.id)
      await loadUsers()
      await showAlert({ message: 'User permanently deleted successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to delete user permanently:', error)
      await showAlert({ message: error.message || 'Failed to delete user permanently', type: 'error' })
    }
  }

  const handleInvitation = async (user: User) => {
    try {
      setInvitingUser(user.id)
      const result = await api.request(`/users/${user.id}/invitation`, { method: 'POST' })
      setInvitationUrl(result.url)
    } catch (error: any) {
      await showAlert({ message: error.message || 'Unable to generate invitation link', type: 'error' })
    } finally { setInvitingUser(null) }
  }

  const resetUserForm = () => {
    setUserFormData({
      username: '',
        fullName: '',
      email: '',
      role: 'client',
      position: '',
      timezone: '',
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
      await showAlert({ message: 'Please select a client', type: 'warning' })
      return
    }

    try {
      await api.assignUserToClient(
        selectedUserForAssignment.id,
        Number(assignmentFormData.clientId),
        {
          accessLevel: assignmentFormData.accessLevel,
          assignedBy: 1 // TODO: Get current user ID
        }
      )

      await loadUsers()
      setIsClientAssignmentDialogOpen(false)
      setSelectedUserForAssignment(null)
      await showAlert({ message: 'User assigned to client successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to assign user to client:', error)
      await showAlert({ message: error.message || 'Failed to assign user to client', type: 'error' })
    }
  }

  const handleRemoveFromClient = async (userId: number, clientId: number, clientName: string) => {
    const confirmed = await showConfirm({
      title: 'Remove from Client',
      message: `Remove user from "${clientName}"?`,
      type: 'warning',
      confirmText: 'Remove',
      cancelText: 'Cancel',
    })

    if (!confirmed) return

    try {
      await api.removeUserFromClient(userId, clientId)
      await loadUsers()
      await showAlert({ message: 'User removed from client successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to remove user from client:', error)
      await showAlert({ message: error.message || 'Failed to remove user from client', type: 'error' })
    }
  }

  const handleUpdateClientAccess = async (userId: number, clientId: number, newAccessLevel: 'read' | 'write' | 'admin') => {
    try {
      await api.updateClientAssignment(userId, clientId, { accessLevel: newAccessLevel })
      await loadUsers()
      await showAlert({ message: 'Access level updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update access level:', error)
      await showAlert({ message: error.message || 'Failed to update access level', type: 'error' })
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

  const activeUsers = users.filter((user) => user.isActive).length
  const clientUsers = users.filter((user) => user.role === 'client').length
  const teamUsers = users.filter((user) => user.role === 'team_member').length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeroSkeleton />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <MetricTileSkeleton key={index} />
          ))}
        </div>
        <CardSkeleton titleWidth="w-44" lines={3} />
        <TableSkeleton rows={6} columns={5} />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHero
        eyebrow="Administration"
        title="User management"
        description="Manage system users, assign roles, and control client portal access from one operational workspace."
        theme="violet"
        actions={(
          <Button onClick={() => setIsUserDialogOpen(true)} title="Create a new user">
            <Plus className="mr-2 h-4 w-4" />
            Create user
          </Button>
        )}
        meta={(
          <>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {users.length} total users
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {activeUsers} active
            </span>
          </>
        )}
      />

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 px-1 pb-1 touch-scroll-x sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
        <div className="min-w-[15rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Active Accounts"
            value={activeUsers}
            hint={`${users.length - activeUsers} inactive`}
            icon={<UserCheck className="h-5 w-5" />}
            tone="emerald"
          />
        </div>
        <div className="min-w-[15rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Team Members"
            value={teamUsers}
            hint="Internal staff accounts"
            icon={<Briefcase className="h-5 w-5" />}
            tone="primary"
          />
        </div>
        <div className="min-w-[15rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Client Users"
            value={clientUsers}
            hint="Portal-assigned external users"
            icon={<Building className="h-5 w-5" />}
            tone="amber"
          />
        </div>
      </div>

      <Card className="border-white/80 bg-white/88 content-auto">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_14rem_auto] xl:items-end">
            <div className="space-y-2.5">
              <Label htmlFor="search">Search Users</Label>
              <Input
                id="search"
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="space-y-2.5">
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
            <div className="flex xl:justify-end">
              <Button onClick={handleSearch} title="Search users" className="w-full xl:w-auto">
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/80 bg-white/88 content-auto">
        <CardHeader className="pb-3">
          <SectionHeading
            title={`Users (${filteredUsers.length})`}
            description="All system users with role assignments, status, and client access."
            icon={<Users className="h-5 w-5" />}
          />
        </CardHeader>
        <CardContent className="pt-0">
          {filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="rounded-[1.35rem] border border-border/70 bg-muted/15 px-4 pb-4 pt-4 shadow-[0_22px_45px_-36px_rgba(15,23,42,0.35)] sm:px-5 sm:pb-5 sm:pt-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-3.5">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.fullName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {getRoleIcon(user.role)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{user.fullName}</p>
                          <Badge className={getRoleBadgeClass(user.role)}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">{user.clerkUserId ? 'Clerk linked' : 'Pending Clerk sign-in'}</Badge>
                          {user.role === 'team_member' && !user.teamMemberId && <Badge variant="outline">Employee profile required</Badge>}
                          {!user.isActive && (
                            <Badge variant="outline" className="text-red-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span>@{user.username}</span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                          {user.position && <span>{user.position}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 self-start sm:w-auto">
                      {!user.clerkUserId && <Button variant="outline" size="sm" disabled={!user.isActive || invitingUser !== null || (user.role === 'team_member' && !user.teamMemberId)} onClick={() => handleInvitation(user)}>{invitingUser === user.id ? 'Generating…' : 'Generate invite link'}</Button>}
                      {user.role === 'client' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManageClientAssignment(user)}
                          className="text-purple-600 hover:text-purple-700"
                          title="Manage client assignments"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleUserStatus(user)}
                        className={user.isActive ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                        title={user.isActive ? "Deactivate user" : "Activate user"}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUserPermanently(user)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete user permanently (cannot be undone)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Client Assignments Section */}
                  {user.role === 'client' && (
                    <div className="mt-4 border-t border-border/70 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Building className="h-4 w-4" />
                          Client Assignments
                        </h4>
                      </div>
                      {user.clientAssignments && user.clientAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {user.clientAssignments.map((assignment) => (
                            <div
                              key={assignment.assignmentId}
                              className="flex items-start justify-between gap-3 rounded-[1rem] border border-border/60 bg-white/90 px-4 pb-4 pt-4"
                            >
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
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
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                  Assigned: {new Date(assignment.assignedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                        <div className="py-3 text-center text-sm text-muted-foreground">
                          <Building className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
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
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    <span>Created: {new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {user.lastLoginAt && (
                      <span>Last login: {new Date(user.lastLoginAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No users found"
              description="No users match the current search and role filters."
            />
          )}
        </CardContent>
      </Card>

      {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{loadError}<Button variant="outline" className="ml-3" onClick={() => { loadUsers(); loadAvailableClients() }}>Retry</Button></div>}
      {pages > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page <= 1 || isLoading} onClick={() => loadUsers(searchTerm, roleFilter, page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="outline" disabled={page >= pages || isLoading} onClick={() => loadUsers(searchTerm, roleFilter, page + 1)}>Next</Button></div>}
      <Dialog open={!!invitationUrl} onOpenChange={open => { if (!open) setInvitationUrl('') }}><DialogContent><DialogHeader><DialogTitle>Clerk invitation link</DialogTitle><DialogDescription>No email was sent. Copy this link and share it with the intended user. It expires according to the Clerk invitation policy.</DialogDescription></DialogHeader><Input aria-label="Invitation link" value={invitationUrl} readOnly /><Button onClick={async () => { try { await navigator.clipboard.writeText(invitationUrl); await showAlert({ message: 'Invitation link copied', type: 'success' }) } catch { await showAlert({ message: 'Copy the link from the field above', type: 'warning' }) } }}>Copy link</Button></DialogContent></Dialog>
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
              <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">Sign-in and passwords are managed by Clerk. To reset a password, use “Forgot password” on the sign-in page.</div>
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
                    setUserFormData({ ...userFormData, role: value })
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
            </div>

            <div>
              <Label htmlFor="userPosition">Position</Label>
              <Input
                id="userPosition"
                value={userFormData.position}
                onChange={(e) => setUserFormData({ ...userFormData, position: e.target.value })}
                placeholder="e.g. HR Manager, PM, Designer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the user's position or job title
              </p>
            </div>

            <div>
              <Label>Timezone</Label>
              <TimezoneSelect
                value={userFormData.timezone || undefined}
                onChange={(value) => setUserFormData({ ...userFormData, timezone: value })}
                placeholder="Select timezone..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for displaying shift times in the correct timezone
              </p>
            </div>

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
            <Button disabled={isSaving} onClick={isEditingUser ? handleUpdateUser : handleCreateUser}>
              {isSaving ? 'Saving…' : isEditingUser ? 'Update User' : 'Create User'}
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
                    <li key={assignment.assignmentId}>
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
