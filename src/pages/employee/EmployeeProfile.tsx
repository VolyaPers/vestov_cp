import { useState, useEffect } from 'react'
import { User, Mail, Phone, MapPin, Calendar, Edit3, Save, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/lib/api'

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
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    phone: '',
    location: '',
    bio: ''
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)

      // Get employee profile
      const member = await api.request('/vacation/my-profile')

      setTeamMember(member)
      setFormData({
        phone: member.phone || '',
        location: member.location || '',
        bio: member.bio || ''
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
        ...formData
      })

      await loadProfile()
      setEditing(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      phone: teamMember?.phone || '',
      location: teamMember?.location || '',
      bio: teamMember?.bio || ''
    })
    setEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!teamMember) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Profile not found</p>
      </div>
    )
  }

  const initials = teamMember.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">View and edit your personal information</p>
        </div>
        {!editing ? (
          <Button
            onClick={() => setEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 pb-6 border-b border-gray-200">
            <Avatar className="h-24 w-24">
              <AvatarImage src={teamMember.avatarUrl} alt={teamMember.name} />
              <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{teamMember.name}</h2>
              <p className="text-gray-600 mt-1">{teamMember.role}</p>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  Started {new Date(teamMember.startDate).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Email (read-only) */}
            <div>
              <Label className="flex items-center gap-2 text-gray-700 mb-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                value={teamMember.email}
                disabled
                className="bg-gray-50"
              />
            </div>

            {/* Phone */}
            <div>
              <Label className="flex items-center gap-2 text-gray-700 mb-2">
                <Phone className="h-4 w-4" />
                Phone
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!editing}
                placeholder="Enter your phone number"
                className={!editing ? 'bg-gray-50' : ''}
              />
            </div>

            {/* Location */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-2 text-gray-700 mb-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={!editing}
                placeholder="Enter your location"
                className={!editing ? 'bg-gray-50' : ''}
              />
            </div>

            {/* Bio */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-2 text-gray-700 mb-2">
                <User className="h-4 w-4" />
                Bio
              </Label>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!editing}
                placeholder="Tell us about yourself..."
                rows={4}
                className={!editing ? 'bg-gray-50' : ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
