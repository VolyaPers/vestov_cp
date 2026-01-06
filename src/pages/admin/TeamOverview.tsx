import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import {
  Users,
  DollarSign,
  Briefcase,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Star,
  Clock,
  X,
  Edit3,
  Trash2,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EditTeamMemberDialog } from '@/components/EditTeamMemberDialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import type { CreateTeamMemberData, UpdateTeamMemberData, TeamMemberStatus, User } from '@/types/common'

// Local TeamMember interface extends common type with additional fields from API
interface LocalTeamMember {
  id: number
  name: string
  role: string
  email: string
  phone?: string
  skills?: string[]
  bio?: string
  hourlyRate?: string | number
  monthlyRate?: string | number
  isBillable: boolean
  status: string
  startDate: string
  location?: string
  avatarUrl?: string
  clientId?: number
  clientName?: string
}

type AvailableUser = User

// TeamOverview Component - Updated 2026-01-06
export function TeamOverview() {
  const [teamMembers, setTeamMembers] = useState<LocalTeamMember[]>([])
  const [billableMembers, setBillableMembers] = useState<LocalTeamMember[]>([])
  const [internalStaff, setInternalStaff] = useState<LocalTeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingMember, setEditingMember] = useState<LocalTeamMember | null>(null)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    hourlyRate: '',
    monthlyRate: '',
    isBillable: true,
    status: 'bench' as 'active' | 'bench' | 'unavailable',
    startDate: new Date().toISOString().split('T')[0],
    skills: [] as string[],
    clientId: undefined as number | undefined
  })

  useEffect(() => {
    loadTeamMembers()
    loadAvailableUsers()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (isSelectOpen && !target.closest('.team-member-dropdown')) {
        setIsSelectOpen(false)
      }
    }

    if (isSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSelectOpen])

  const loadAvailableUsers = async () => {
    try {
      const users = await api.getAvailableTeamMemberUsers()
      setAvailableUsers(users)
    } catch (error) {
      console.error('[TeamOverview] Failed to load available users:', error)
      setAvailableUsers([])
    }
  }

  const loadTeamMembers = async () => {
    try {
      setIsLoading(true)
      const data = (await api.getTeamMembers()) as unknown as LocalTeamMember[]
      setTeamMembers(data)

      // Separate billable and non-billable members
      const billable = data.filter((member: LocalTeamMember) => member.isBillable)
      const internal = data.filter((member: LocalTeamMember) => !member.isBillable)

      setBillableMembers(billable)
      setInternalStaff(internal)
    } catch (error) {
      console.error('Failed to load team members:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTeamMember = async (userId?: string) => {
    const userIdToUse = userId || selectedUserId
    if (!userIdToUse) {
      alert('Please select a user to add as team member')
      return
    }

    try {
      setIsSubmitting(true)
      // Create team member and link to user
      await api.createTeamMember({ userId: parseInt(userIdToUse) })
      await loadTeamMembers()
      await loadAvailableUsers() // Refresh available users list
      setSelectedUserId('')
      setIsSelectOpen(false)
      alert('Team member added successfully.')
    } catch (error) {
      console.error('Error adding team member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error adding team member. Please try again.'
      alert(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setNewMember({
      name: '',
      role: '',
      email: '',
      phone: '',
      location: '',
      bio: '',
      hourlyRate: '',
      monthlyRate: '',
      isBillable: true,
      status: 'bench',
      startDate: new Date().toISOString().split('T')[0],
      skills: [],
      clientId: undefined
    })
  }

  const handleEditTeamMember = (member: LocalTeamMember) => {
    setEditingMember(member)
    setIsEditModalOpen(true)
  }

  const handleUpdateTeamMember = async () => {
    if (!editingMember || !editingMember.name.trim() || !editingMember.email.trim() || !editingMember.role.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      // Convert local TeamMember format to UpdateTeamMemberData
      const updateData: UpdateTeamMemberData = {
        name: editingMember.name,
        email: editingMember.email,
        position: editingMember.role,
        skills: editingMember.skills || [],
        hourlyRate: typeof editingMember.hourlyRate === 'string' ? parseFloat(editingMember.hourlyRate || '0') : editingMember.hourlyRate || 0,
        experienceLevel: 'middle', // Should be selectable in UI
        status: editingMember.status as TeamMemberStatus,
        bio: editingMember.bio || undefined,
        location: editingMember.location || undefined,
        clientId: editingMember.clientId
      }
      await api.updateTeamMember(editingMember.id.toString(), updateData)
      await loadTeamMembers()
      setIsEditModalOpen(false)
      setEditingMember(null)
      alert('Team member updated successfully.')
    } catch (error) {
      console.error('Error updating team member:', error)
      alert('Error updating team member. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTeamMember = async (memberId: number, memberName: string) => {
    if (!confirm(`Are you sure you want to delete ${memberName}? This action cannot be undone.`)) {
      return
    }

    try {
      await api.deleteTeamMember(memberId.toString())
      await loadTeamMembers()
      alert('Team member deleted successfully.')
    } catch (error) {
      console.error('Error deleting team member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Error deleting team member: ${errorMessage}`)
    }
  }

  const getFilteredMembers = (members: LocalTeamMember[]) => {
    if (!searchTerm) return members
    
    return members.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.location?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'bench':
        return 'bg-yellow-100 text-yellow-800'
      case 'unavailable':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const MemberCard = ({ member }: { member: LocalTeamMember }) => (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4">
          <div className="relative">
            <Link href={`/admin/team-detail/${member.id}`} className="cursor-pointer">
              <Avatar className="h-12 w-12 ring-2 ring-gray-100 hover:ring-blue-300 transition-all duration-200">
                <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover" />
                <AvatarFallback className="bg-slate-700 text-white font-medium">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ring-2 ring-white ${
              member.status === 'active' ? 'bg-green-400' :
              member.status === 'bench' ? 'bg-yellow-400' : 'bg-gray-400'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/admin/team-detail/${member.id}`}>
              <h3 className="font-semibold text-gray-900 text-lg leading-tight hover:text-blue-600 cursor-pointer transition-colors">{member.name}</h3>
            </Link>
            <p className="text-gray-600 text-sm mt-0.5">{member.role}</p>
            {member.location && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                <span>{member.location}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/admin/team-detail/${member.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            onClick={() => handleEditTeamMember(member)}
            title="Edit team member"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            onClick={() => handleDeleteTeamMember(member.id, member.name)}
            title="Delete team member"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="h-3.5 w-3.5 text-gray-400" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            <span>{member.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span>Started {format(new Date(member.startDate), 'MMM d, yyyy')}</span>
        </div>
      </div>

      {/* Skills */}
      {member.skills && member.skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {member.skills.slice(0, 4).map((skill, index) => (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
              >
                {skill}
              </span>
            ))}
            {member.skills.length > 4 && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
                +{member.skills.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Billable Info */}
      {member.isBillable && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {member.hourlyRate && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(parseFloat(String(member.hourlyRate || '0')))}
                    </div>
                    <div className="text-xs text-gray-500">per hour</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {member.clientName && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-md">
                  <Briefcase className="h-3 w-3 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">{member.clientName}</span>
                </div>
              )}
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                member.status === 'active' && member.clientId ? 'bg-green-50 text-green-700' :
                member.status === 'bench' || !member.clientId ? 'bg-yellow-50 text-yellow-700' :
                'bg-gray-50 text-gray-700'
              }`}>
                {member.status === 'active' && member.clientId ? 'Assigned' :
                 member.status === 'bench' || !member.clientId ? 'Available' : 
                 member.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-billable info */}
      {!member.isBillable && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50">
                <UserCheck className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Internal Team</span>
            </div>
            <div className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">
              {member.status}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Team
            </h1>
            <p className="stripe-text-secondary text-lg">
              Manage your billable resources and internal staff
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="stripe-badge-success">
              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--stripe-success)' }}></div>
              {billableMembers.filter(m => m.status === 'active' && m.clientId).length} Active
            </div>
            <div className="stripe-badge-warning">
              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--stripe-warning)' }}></div>
              {billableMembers.filter(m => m.status === 'bench' || !m.clientId).length} Available
            </div>
          </div>
        </div>
      </div>

      {/* Statistics - Stripe style */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <Users className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold stripe-text-primary">{teamMembers.length}</div>
              <div className="text-sm stripe-text-secondary">Total Team</div>
            </div>
          </div>
          <div className="text-sm stripe-text-muted">All team members </div>
        </div>

        <div className="stripe-card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg stripe-surface flex items-center justify-center">
              <DollarSign className="h-6 w-6 stripe-text-muted" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{billableMembers.length}</div>
              <div className="text-sm font-medium text-green-700">Billable Resources</div>
            </div>
          </div>
          <div className="text-sm text-green-600 font-medium">Available for clients</div>
        </div>

        <div className="stripe-card rounded-lg p-6 hover:shadow-md transition-all duration-150">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-100">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{internalStaff.length}</div>
              <div className="text-sm font-medium text-purple-700">Internal Staff</div>
            </div>
          </div>
          <div className="text-sm text-purple-600 font-medium">Non-billable members</div>
        </div>

        <div className="group relative bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100 hover:border-orange-200 transition-all duration-200 hover:shadow-lg hover:shadow-orange-100/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {billableMembers.filter(m => m.status === 'bench' || !m.clientId).length}
              </div>
              <div className="text-sm font-medium text-orange-700">Available Now</div>
            </div>
          </div>
          <div className="text-sm text-orange-600 font-medium">Ready for assignment</div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, role, email, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2" style={{ minWidth: '200px' }}>
          <div className="relative team-member-dropdown" style={{ display: 'block' }}>
            <button
              type="button"
            onClick={() => {
              if (availableUsers.length === 0) {
                  alert('No users available with role "team_member". Please create a user with this role first.')
                  return
                }
                setIsSelectOpen(!isSelectOpen)
              }}
              disabled={availableUsers.length === 0 || isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{ display: 'inline-flex', visibility: 'visible', minWidth: '150px', position: 'relative', zIndex: 1 }}
            >
              <Plus className="h-4 w-4" />
              Add Team Member
            </button>
            {isSelectOpen && availableUsers.length > 0 && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="p-2">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={async () => {
                        setIsSelectOpen(false)
                        await handleAddTeamMember(user.id.toString())
                      }}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded-md text-sm"
                    >
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-gray-500 text-xs">{user.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Team Member Dialog */}
      <EditTeamMemberDialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) {
            setEditingMember(null)
          }
        }}
        member={editingMember}
        onMemberChange={(updates) => {
          if (editingMember) {
            setEditingMember({ ...editingMember, ...updates })
          }
        }}
        onSave={handleUpdateTeamMember}
        isSubmitting={isSubmitting}
      />

      {/* Tabs for different member types - Stripe style */}
      <div className="stripe-card">
        <div className="border-b stripe-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'all'
                  ? 'border-[var(--stripe-primary)] text-[var(--stripe-primary)]'
                  : 'border-transparent stripe-text-secondary hover:stripe-text-primary hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 mr-2 inline" />
              All Team Members! ({teamMembers.length})
            </button>
            <button
              onClick={() => setActiveTab('billable')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'billable'
                  ? 'border-[var(--stripe-primary)] text-[var(--stripe-primary)]'
                  : 'border-transparent stripe-text-secondary hover:stripe-text-primary hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-4 w-4 mr-2 inline" />
              Billable Resources ({billableMembers.length})
            </button>
            <button
              onClick={() => setActiveTab('internal')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'internal'
                  ? 'border-[var(--stripe-primary)] text-[var(--stripe-primary)]'
                  : 'border-transparent stripe-text-secondary hover:stripe-text-primary hover:border-gray-300'
              }`}
            >
              <UserCheck className="h-4 w-4 mr-2 inline" />
              Internal Staff ({internalStaff.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Tab Content */}
          {activeTab === 'all' && (
            <div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {getFilteredMembers(teamMembers).map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
              {getFilteredMembers(teamMembers).length === 0 && (
                <div className="stripe-surface rounded-lg p-12 text-center stripe-border">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-lg stripe-surface flex items-center justify-center">
                    <Users className="h-8 w-8 stripe-text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold stripe-text-primary mb-2">No team members found</h3>
                  <p className="stripe-text-muted">Try adjusting your search or add new team members</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'billable' && (
            <div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {getFilteredMembers(billableMembers).map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
              {getFilteredMembers(billableMembers).length === 0 && (
                <div className="stripe-surface rounded-lg p-12 text-center stripe-border">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-lg stripe-surface flex items-center justify-center">
                    <DollarSign className="h-8 w-8 stripe-text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold stripe-text-primary mb-2">No billable members found</h3>
                  <p className="stripe-text-muted">Try adjusting your search or add new billable team members</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'internal' && (
            <div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {getFilteredMembers(internalStaff).map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
              {getFilteredMembers(internalStaff).length === 0 && (
                <div className="stripe-surface rounded-lg p-12 text-center stripe-border">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-lg stripe-surface flex items-center justify-center">
                    <UserCheck className="h-8 w-8 stripe-text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold stripe-text-primary mb-2">No internal staff found</h3>
                  <p className="stripe-text-muted">Try adjusting your search or add new internal staff members</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}