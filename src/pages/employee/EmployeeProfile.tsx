import { useEffect, useState } from 'react'
import { Calendar, Edit3, Mail, MapPin, Phone, Save, User, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatDate, parseLocalDate } from '@/lib/utils'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

interface TeamMember {
  id: number
  name: string
  role: string
  email: string
  phone?: string
  location?: string
  bio?: string
  avatarUrl?: string
  startDate: string
}

export function EmployeeProfile() {
  const { showAlert } = useCustomAlert()
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    phone: '',
    location: '',
    bio: '',
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const member = await api.request('/vacation/my-profile')

      setTeamMember(member)
      setFormData({
        phone: member.phone || '',
        location: member.location || '',
        bio: member.bio || '',
      })
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!teamMember) return

    try {
      setSaving(true)
      await api.updateTeamMember(String(teamMember.id), {
        ...teamMember,
        ...formData,
      })

      await loadProfile()
      setEditing(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      showAlert({ message: 'Failed to save profile. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      phone: teamMember?.phone || '',
      location: teamMember?.location || '',
      bio: teamMember?.bio || '',
    })
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!teamMember) {
    return (
      <EmptyState
        icon={<User className="h-6 w-6" />}
        title="Profile not found"
        description="Your employee profile is unavailable right now."
      />
    )
  }

  const initials = teamMember.name
    .split(' ')
    .map((name) => name[0])
    .join('')
    .toUpperCase()

  const profileCompletion = [teamMember.phone, teamMember.location, teamMember.bio].filter(Boolean).length
  const startedAt = formatDate(parseLocalDate(teamMember.startDate))

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Employee Workspace"
        title="Personal profile and contact card"
        description="Keep your public team profile and contact details current for operations, HR, and client-facing collaboration."
        theme="violet"
        actions={editing ? (
          <>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        ) : (
          <Button onClick={() => setEditing(true)}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
        )}
        meta={(
          <>
            <span className="hero-meta-pill">
              {teamMember.role}
            </span>
            <span className="hero-meta-pill">
              Started {startedAt}
            </span>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Profile Completion"
          value={`${profileCompletion}/3`}
          hint="Phone, location, and bio fields"
          icon={<User className="h-5 w-5" />}
          tone="violet"
        />
        <MetricTile
          label="Primary Contact"
          value={teamMember.phone || 'Not set'}
          hint={teamMember.email}
          icon={<Phone className="h-5 w-5" />}
          tone="primary"
        />
        <MetricTile
          label="Based In"
          value={teamMember.location || 'Not set'}
          hint={`Member since ${startedAt}`}
          icon={<MapPin className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <Card className="overflow-hidden border-white/80 bg-white/88">
          <CardContent className="p-6 sm:p-7">
            <SectionHeading
              title="Public profile card"
              description="How your identity appears in the employee workspace."
              icon={<User className="h-5 w-5" />}
            />

            <div className="rounded-[1.5rem] border border-white/80 bg-white/76 p-6 text-foreground shadow-[0_28px_60px_-36px_rgba(15,23,42,0.26)] backdrop-blur-xl">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar className="h-24 w-24 border-4 border-white/80 shadow-[0_24px_40px_-24px_rgba(15,23,42,0.22)]">
                  <AvatarImage src={teamMember.avatarUrl} alt={teamMember.name} />
                  <AvatarFallback className="bg-primary/10 font-display text-2xl text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-2">
                  <h2 className="font-display text-3xl font-semibold">{teamMember.name}</h2>
                  <p className="text-sm text-muted-foreground">{teamMember.role}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="hero-meta-pill">{teamMember.email}</span>
                    <span className="hero-meta-pill">Started {startedAt}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{teamMember.email}</p>
              </div>
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  Start date
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{startedAt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/88">
          <CardContent className="p-6 sm:p-7">
            <SectionHeading
              title="Editable details"
              description="Update your operational contact information and short bio."
              icon={<Edit3 className="h-5 w-5" />}
            />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label className="mb-2 flex items-center gap-2 text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </Label>
                <Input value={teamMember.email} disabled className="bg-muted/35" />
              </div>

              <div>
                <Label className="mb-2 flex items-center gap-2 text-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  Phone
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  disabled={!editing}
                  placeholder="Enter your phone number"
                  className={!editing ? 'bg-muted/35' : ''}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="mb-2 flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location
                </Label>
                <Input
                  value={formData.location}
                  onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                  disabled={!editing}
                  placeholder="Enter your location"
                  className={!editing ? 'bg-muted/35' : ''}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="mb-2 flex items-center gap-2 text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Bio
                </Label>
                <Textarea
                  value={formData.bio}
                  onChange={(event) => setFormData({ ...formData, bio: event.target.value })}
                  disabled={!editing}
                  placeholder="Tell us about yourself..."
                  rows={6}
                  className={!editing ? 'bg-muted/35' : ''}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
