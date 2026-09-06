import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
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
  Eye,
  Globe
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EditTeamMemberDialog } from '@/components/EditTeamMemberDialog'
import { Label } from '@/components/ui/label'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, parseLocalDate } from '@/lib/utils'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { convertTime, getBrowserTimezone, getTimezoneAbbreviation } from '@/lib/timezone'
import type { CreateTeamMemberData, UpdateTeamMemberData, TeamMemberStatus, User } from '@/types/common'
import { CardSkeleton, EmptyState, MetricTile, MetricTileSkeleton, PageHero, PageHeroSkeleton, SectionHeading, TableSkeleton } from '@/components/page-primitives'

// Local TeamMember interface extends common type with additional fields from API
interface LocalTeamMember {
  id: number
  name: string
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
  timezone?: string
  position: string
  employmentType?: 'fulltime' | 'part_time' | 'freelancer'
  showOnCalendar: boolean
  avatarUrl?: string
  clientId?: number
  clientName?: string
}

type AvailableUser = User

// TeamOverview Component - Updated 2026-01-06
export function TeamOverview() {
  const [location] = useLocation()
  const { showAlert, showConfirm } = useCustomAlert()
  const [teamMembers, setTeamMembers] = useState<LocalTeamMember[]>([])
  const [billableMembers, setBillableMembers] = useState<LocalTeamMember[]>([])
  const [internalStaff, setInternalStaff] = useState<LocalTeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [activeTab, setActiveTab] = useState('all')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingMember, setEditingMember] = useState<LocalTeamMember | null>(null)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    position: '',
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

  // Fetch current user for timezone
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  })

  // Fetch all preferred shifts
  const { data: preferredShiftsData } = useQuery({
    queryKey: ['allPreferredShifts'],
    queryFn: () => api.getAllPreferredShifts(),
  })

  const viewerTimezone = currentUser?.timezone || getBrowserTimezone()

  // Helper: get typical shift range for a member (Mon-Fri summary)
  const getMemberShiftSummary = (memberId: number) => {
    const memberData = preferredShiftsData?.members?.find((m: any) => m.employee.id === memberId)
    if (!memberData || !memberData.schedules?.length) return null

    const activeSchedules = memberData.schedules.filter((s: any) => s.isActive)
    if (activeSchedules.length === 0) return null

    const memberTz = memberData.employee?.timezone
    // Get most common start/end times
    const startTimes = activeSchedules.map((s: any) => s.startTime)
    const endTimes = activeSchedules.map((s: any) => s.endTime)
    const typicalStart = startTimes.sort((a: string, b: string) => startTimes.filter((t: string) => t === a).length - startTimes.filter((t: string) => t === b).length).pop()
    const typicalEnd = endTimes.sort((a: string, b: string) => endTimes.filter((t: string) => t === a).length - endTimes.filter((t: string) => t === b).length).pop()

    if (memberTz && memberTz !== viewerTimezone) {
      const start = convertTime(typicalStart, memberTz, viewerTimezone)
      const end = convertTime(typicalEnd, memberTz, viewerTimezone)
      return { startTime: start.time, endTime: end.time, abbreviation: start.abbreviation, memberTz }
    }
    return { startTime: typicalStart, endTime: typicalEnd, abbreviation: memberTz ? getTimezoneAbbreviation(memberTz) : '', memberTz }
  }

  useEffect(() => {
    loadTeamMembers()
    loadAvailableUsers()
  }, [])

  useEffect(() => {
    const nextQuery = new URLSearchParams(window.location.search).get('q') ?? ''
    setSearchTerm(nextQuery)
  }, [location])

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
      await showAlert({ message: 'Please select a user to add as team member', type: 'warning' })
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
      await showAlert({ message: 'Team member added successfully.', type: 'success' })
    } catch (error) {
      console.error('Error adding team member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error adding team member. Please try again.'
      await showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setNewMember({
      name: '',
      position: '',
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
    if (!editingMember || !editingMember.name.trim() || !editingMember.email.trim() || !editingMember.position?.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      // Convert local TeamMember format to UpdateTeamMemberData
      // Include ALL fields that can be edited, especially startDate, phone, and isBillable
      const updateData: UpdateTeamMemberData & { startDate?: string; phone?: string; isBillable?: boolean } = {
        name: editingMember.name,
        email: editingMember.email,
        skills: editingMember.skills || [],
        hourlyRate: typeof editingMember.hourlyRate === 'string' ? parseFloat(editingMember.hourlyRate || '0') : editingMember.hourlyRate || 0,
        status: editingMember.status as TeamMemberStatus,
        bio: editingMember.bio || undefined,
        location: editingMember.location || undefined,
        timezone: editingMember.timezone || undefined,
        clientId: editingMember.clientId,
        startDate: editingMember.startDate, // Include startDate
        phone: editingMember.phone || undefined, // Include phone
        isBillable: editingMember.isBillable, // Include isBillable
        position: editingMember.position,
        employmentType: editingMember.employmentType,
        showOnCalendar: editingMember.showOnCalendar,
      }
      await api.updateTeamMember(editingMember.id.toString(), updateData)
      await loadTeamMembers()
      setIsEditModalOpen(false)
      setEditingMember(null)
      await showAlert({ message: 'Team member updated successfully.', type: 'success' })
    } catch (error) {
      console.error('Error updating team member:', error)
      await showAlert({ message: 'Error updating team member. Please try again.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTeamMember = async (memberId: number, memberName: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Team Member',
      message: `Are you sure you want to delete ${memberName}? This action cannot be undone.`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.deleteTeamMember(memberId.toString())
      await loadTeamMembers()
      await showAlert({ message: 'Team member deleted successfully.', type: 'success' })
    } catch (error) {
      console.error('Error deleting team member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await showAlert({ message: `Error deleting team member: ${errorMessage}`, type: 'error' })
    }
  }

  const getFilteredMembers = (members: LocalTeamMember[]) => {
    if (!searchTerm) return members

    return members.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.position || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    <div className="group relative rounded-2xl border border-border/80 bg-white p-5 transition-colors hover:bg-slate-50/70">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className="relative">
            <Link href={`/admin/team-detail/${member.id}`} className="cursor-pointer">
              <Avatar className="h-12 w-12 ring-1 ring-border/70 transition-all duration-200 group-hover:ring-blue-200">
                <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover" />
                <AvatarFallback className="bg-slate-700 text-white font-medium">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ring-2 ring-white ${member.status === 'active' ? 'bg-emerald-400' :
              member.status === 'bench' ? 'bg-amber-400' : 'bg-slate-400'
              }`} />
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/admin/team-detail/${member.id}`}>
              <h3 className="cursor-pointer text-base font-semibold leading-tight text-foreground transition-colors hover:text-blue-600">{member.name}</h3>
            </Link>
            <p className="mt-0.5 text-sm text-muted-foreground">{member.position}</p>
            {member.location && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{member.location}</span>
              </div>
            )}
            {(() => {
              const shiftSummary = getMemberShiftSummary(member.id)
              const tz = member.timezone
              if (!tz && !shiftSummary) return null
              return (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {tz ? <Globe className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {tz && <span>{getTimezoneAbbreviation(tz)}</span>}
                  {shiftSummary && (
                    <span className="text-indigo-600 font-medium">
                      {tz ? ' · ' : ''}{shiftSummary.startTime} - {shiftSummary.endTime}
                    </span>
                  )}
                </div>
              )
            })()}
          </div>
        </div>

        <div className="flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <Link href={`/admin/team-detail/${member.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600"
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

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 text-slate-400" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            <span>{member.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>Started {format(parseLocalDate(member.startDate), 'd MMMM yyyy')}</span>
        </div>
      </div>

      {member.skills && member.skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {member.skills.slice(0, 4).map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-border/80 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
              >
                {skill}
              </span>
            ))}
            {member.skills.length > 4 && (
              <span className="inline-flex items-center rounded-md border border-border/80 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                +{member.skills.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {member.isBillable && (
        <div className="border-t border-border/70 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {member.hourlyRate && (
                <div className="flex items-center gap-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {formatCurrency(parseFloat(String(member.hourlyRate || '0')))}
                    </div>
                    <div className="text-xs text-muted-foreground">per hour</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {member.clientName && (
                <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1">
                  <Briefcase className="h-3 w-3 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">{member.clientName}</span>
                </div>
              )}
              {member.employmentType && member.employmentType !== 'fulltime' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {member.employmentType === 'part_time' ? 'Part-time' : 'Freelancer'}
                </span>
              )}
              <div className={`rounded-md px-2 py-1 text-xs font-medium ${member.status === 'active' && member.clientId ? 'bg-emerald-50 text-emerald-700' :
                member.status === 'bench' || !member.clientId ? 'bg-amber-50 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                {member.status === 'active' && member.clientId ? 'Assigned' :
                  member.status === 'bench' || !member.clientId ? 'Available' :
                    member.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {!member.isBillable && (
        <div className="border-t border-border/70 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <UserCheck className="h-4 w-4 text-violet-600" />
              </div>
              <span className="text-sm font-medium text-foreground">Internal team</span>
            </div>
            {member.employmentType && member.employmentType !== 'fulltime' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {member.employmentType === 'part_time' ? 'Part-time' : 'Freelancer'}
              </span>
            )}
            <div className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
              {member.status}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeroSkeleton />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricTileSkeleton key={index} />
          ))}
        </div>
        <CardSkeleton titleWidth="w-44" lines={3} />
        <CardSkeleton titleWidth="w-40" lines={2} />
        <TableSkeleton rows={6} columns={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Admin / Team"
        title="Team"
        description="Track who is staffed, who is available, and how the delivery bench is changing across the team."
        theme="teal"
        meta={
          <>
            <span>{teamMembers.length} team members</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{billableMembers.filter((m) => m.status === 'active' && m.clientId).length} assigned</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{billableMembers.filter((m) => m.status === 'bench' || !m.clientId).length} available</span>
          </>
        }
        aside={
          <Card className="border border-border/80 shadow-none">
            <CardContent className="space-y-3 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workforce split</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-slate-50/70 px-3 py-2.5">
                  <span className="text-sm font-medium text-foreground">Billable resources</span>
                  <span className="text-sm text-muted-foreground">{billableMembers.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-slate-50/70 px-3 py-2.5">
                  <span className="text-sm font-medium text-foreground">Internal staff</span>
                  <span className="text-sm text-muted-foreground">{internalStaff.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile
          label="Total team"
          value={teamMembers.length}
          hint="All people currently in the admin roster."
          icon={<Users className="h-4 w-4" />}
          tone="primary"
        />
        <MetricTile
          label="Billable resources"
          value={billableMembers.length}
          hint="Team members that can be allocated to client work."
          icon={<DollarSign className="h-4 w-4" />}
          tone="emerald"
        />
        <MetricTile
          label="Internal staff"
          value={internalStaff.length}
          hint="Non-billable operational or leadership roles."
          icon={<UserCheck className="h-4 w-4" />}
          tone="violet"
        />
        <MetricTile
          label="Available now"
          value={billableMembers.filter((m) => m.status === 'bench' || !m.clientId).length}
          hint="Bench capacity ready for new assignments."
          icon={<Briefcase className="h-4 w-4" />}
          tone="amber"
        />
      </div>

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

      <Card className="border border-border/80 shadow-none">
        <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SectionHeading
              title="Team directory"
              description="Filter the roster by staffing mode and jump straight into detail work."
              icon={<Users className="h-4 w-4" />}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, position, email, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-xl border-border/80 bg-white pl-10 shadow-none"
                />
              </div>
              <div className="relative team-member-dropdown">
                <Button
                  type="button"
                  onClick={() => {
                    if (availableUsers.length === 0) {
                      showAlert({ message: 'No users available with role "team_member". Please create a user with this role first.', type: 'info' })
                      return
                    }
                    setIsSelectOpen(!isSelectOpen)
                  }}
                  disabled={availableUsers.length === 0 || isSubmitting}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add team member
                </Button>
                {isSelectOpen && availableUsers.length > 0 && (
                  <div className="absolute right-0 z-50 mt-2 max-h-60 w-72 overflow-y-auto rounded-xl border border-border/80 bg-white p-2 shadow-lg">
                    {availableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={async () => {
                          setIsSelectOpen(false)
                          await handleAddTeamMember(user.id.toString())
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="font-medium text-foreground">{user.fullName}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: `All team (${teamMembers.length})`, icon: Users },
              { id: 'billable', label: `Billable (${billableMembers.length})`, icon: DollarSign },
              { id: 'internal', label: `Internal (${internalStaff.length})`, icon: UserCheck },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-border/80 bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {activeTab === 'all' && (
            <div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {getFilteredMembers(teamMembers).map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
              {getFilteredMembers(teamMembers).length === 0 && (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No team members found"
                  description="Try a different search term or add a new team member to the directory."
                />
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
                <EmptyState
                  icon={<DollarSign className="h-5 w-5" />}
                  title="No billable members found"
                  description="Try a different search term or move a team member into a billable role."
                />
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
                <EmptyState
                  icon={<UserCheck className="h-5 w-5" />}
                  title="No internal staff found"
                  description="Try a different search term or create an internal-only team profile."
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
