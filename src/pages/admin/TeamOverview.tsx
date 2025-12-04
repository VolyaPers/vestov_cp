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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { api } from '@/lib/api'

interface TeamMember {
  id: number
  name: string
  role: string
  email: string
  phone?: string
  skills?: string[]
  bio?: string
  hourlyRate?: string
  monthlyRate?: string
  isBillable: boolean
  status: string
  startDate: string
  location?: string
  avatarUrl?: string
  clientId?: number
  clientName?: string
}

export function TeamOverview() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [billableMembers, setBillableMembers] = useState<TeamMember[]>([])
  const [internalStaff, setInternalStaff] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
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
  }, [])

  const loadTeamMembers = async () => {
    try {
      setIsLoading(true)
      const data = await api.getTeamMembers()
      setTeamMembers(data)

      // Separate billable and non-billable members
      const billable = data.filter((member: TeamMember) => member.isBillable)
      const internal = data.filter((member: TeamMember) => !member.isBillable)

      setBillableMembers(billable)
      setInternalStaff(internal)
    } catch (error) {
      console.error('Failed to load team members:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTeamMember = async () => {
    if (!newMember.name.trim() || !newMember.email.trim() || !newMember.role.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      await api.createTeamMember(newMember)
      await loadTeamMembers()
      setIsAddModalOpen(false)
      resetForm()
      alert('Team member added successfully.')
    } catch (error) {
      console.error('Error adding team member:', error)
      alert('Error adding team member. Please try again.')
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

  const handleEditTeamMember = (member: TeamMember) => {
    setEditingMember(member)
    setIsEditModalOpen(true)
  }

  const handleUpdateTeamMember = async () => {
    if (!editingMember || !editingMember.name.trim() || !editingMember.email.trim() || !editingMember.role.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      await api.updateTeamMember(editingMember.id.toString(), editingMember)
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

  const getFilteredMembers = (members: TeamMember[]) => {
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

  const MemberCard = ({ member }: { member: TeamMember }) => (
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
                      {formatCurrency(parseFloat(member.hourlyRate))}
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
          <div className="text-sm stripe-text-muted">All team members</div>
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
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, role, email, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-xl"
          />
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl">
            <DialogHeader className="pb-6 border-b border-gray-100">
              <DialogTitle className="text-2xl font-bold text-gray-900">Add New Team Member</DialogTitle>
              <p className="text-gray-600 mt-2">Add a new team member to your organization</p>
            </DialogHeader>
            
            <div className="py-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                    <Input
                      id="name"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      placeholder="Enter full name"
                      className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-medium text-gray-700">Role *</Label>
                    <Input
                      id="role"
                      value={newMember.role}
                      onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                      placeholder="e.g. Senior Developer, Designer"
                      className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      placeholder="Enter email address"
                      className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                    <Input
                      id="phone"
                      value={newMember.phone}
                      onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                      placeholder="Enter phone number"
                      className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium text-gray-700">Location</Label>
                    <Input
                      id="location"
                      value={newMember.location}
                      onChange={(e) => setNewMember({ ...newMember, location: e.target.value })}
                      placeholder="e.g. San Francisco, CA"
                      className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newMember.startDate}
                      onChange={(e) => setNewMember({ ...newMember, startDate: e.target.value })}
                      className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-medium text-gray-700">Bio</Label>
                <Textarea
                  id="bio"
                  value={newMember.bio}
                  onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
                  placeholder="Brief description about the team member..."
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl min-h-[80px] resize-none"
                />
              </div>

              {/* Employment Type */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Employment Details</h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="billable"
                    checked={newMember.isBillable}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, isBillable: checked })}
                  />
                  <Label htmlFor="billable" className="text-sm font-medium text-gray-700">
                    Billable Resource
                  </Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium text-gray-700">Status</Label>
                    <Select value={newMember.status} onValueChange={(value: 'active' | 'bench' | 'unavailable') => setNewMember({ ...newMember, status: value })}>
                      <SelectTrigger className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="bench">On Bench</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {newMember.isBillable && (
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate" className="text-sm font-medium text-gray-700">Hourly Rate ($)</Label>
                      <Input
                        id="hourlyRate"
                        type="number"
                        value={newMember.hourlyRate}
                        onChange={(e) => setNewMember({ ...newMember, hourlyRate: e.target.value })}
                        placeholder="e.g. 150"
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false)
                  resetForm()
                }}
                className="border-gray-200 hover:bg-gray-50 rounded-xl"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddTeamMember}
                disabled={isSubmitting || !newMember.name.trim() || !newMember.email.trim() || !newMember.role.trim()}
                className="bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Team Member
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Team Member Dialog */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl">
            <DialogHeader className="pb-6 border-b border-gray-100">
              <DialogTitle className="text-2xl font-bold text-gray-900">Edit Team Member</DialogTitle>
              <p className="text-gray-600 mt-2">Update team member information</p>
            </DialogHeader>

            {editingMember && (
              <div className="py-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                      <Input
                        id="edit-name"
                        value={editingMember.name}
                        onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                        placeholder="Enter full name"
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-role" className="text-sm font-medium text-gray-700">Role *</Label>
                      <Input
                        id="edit-role"
                        value={editingMember.role}
                        onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                        placeholder="e.g. Senior Developer, Designer"
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">Email Address *</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editingMember.email}
                        onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                        placeholder="Enter email address"
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                      <Input
                        id="edit-phone"
                        value={editingMember.phone || ''}
                        onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                        placeholder="Enter phone number"
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-location" className="text-sm font-medium text-gray-700">Location</Label>
                      <Input
                        id="edit-location"
                        value={editingMember.location || ''}
                        onChange={(e) => setEditingMember({ ...editingMember, location: e.target.value })}
                        placeholder="e.g. San Francisco, CA"
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                      <Input
                        id="edit-startDate"
                        type="date"
                        value={editingMember.startDate}
                        onChange={(e) => setEditingMember({ ...editingMember, startDate: e.target.value })}
                        className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="edit-bio" className="text-sm font-medium text-gray-700">Bio</Label>
                  <Textarea
                    id="edit-bio"
                    value={editingMember.bio || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, bio: e.target.value })}
                    placeholder="Brief description about the team member..."
                    className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl min-h-[80px] resize-none"
                  />
                </div>

                {/* Employment Type */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Employment Details</h3>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-billable"
                      checked={editingMember.isBillable}
                      onCheckedChange={(checked) => setEditingMember({ ...editingMember, isBillable: checked })}
                    />
                    <Label htmlFor="edit-billable" className="text-sm font-medium text-gray-700">
                      Billable Resource
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-status" className="text-sm font-medium text-gray-700">Status</Label>
                      <Select value={editingMember.status} onValueChange={(value: 'active' | 'bench' | 'unavailable') => setEditingMember({ ...editingMember, status: value })}>
                        <SelectTrigger className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="bench">On Bench</SelectItem>
                          <SelectItem value="unavailable">Unavailable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editingMember.isBillable && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-hourlyRate" className="text-sm font-medium text-gray-700">Hourly Rate ($)</Label>
                        <Input
                          id="edit-hourlyRate"
                          type="number"
                          value={editingMember.hourlyRate || ''}
                          onChange={(e) => setEditingMember({ ...editingMember, hourlyRate: e.target.value })}
                          placeholder="e.g. 150"
                          className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false)
                  setEditingMember(null)
                }}
                className="border-gray-200 hover:bg-gray-50 rounded-xl"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTeamMember}
                disabled={isSubmitting || !editingMember?.name.trim() || !editingMember?.email.trim() || !editingMember?.role.trim()}
                className="bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Update Team Member
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              All Team Members ({teamMembers.length})
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