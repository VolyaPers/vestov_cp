import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Pencil } from 'lucide-react'

export interface EditTeamMemberData {
  id: number
  name: string
  role: string
  email: string
  phone?: string
  skills?: string[]
  bio?: string
  hourlyRate?: string | number
  isBillable: boolean
  status: 'active' | 'bench' | 'unavailable' | string
  startDate: string
  location?: string
  position?: string
  isDeveloper: boolean
  clientId?: number
}

interface EditTeamMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: EditTeamMemberData | null
  onMemberChange: (member: Partial<EditTeamMemberData>) => void
  onSave: () => void
  isSubmitting?: boolean
}

export function EditTeamMemberDialog({
  open,
  onOpenChange,
  member,
  onMemberChange,
  onSave,
  isSubmitting = false,
}: EditTeamMemberDialogProps) {
  if (!member) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl">
        <DialogHeader className="pb-6 border-b border-gray-100">
          <DialogTitle className="text-2xl font-bold text-gray-900">Edit Team Member</DialogTitle>
          <p className="text-gray-600 mt-2">Update team member information</p>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={member.name}
                  onChange={(e) => onMemberChange({ name: e.target.value })}
                  placeholder="Enter full name"
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role" className="text-sm font-medium text-gray-700">Role *</Label>
                <Input
                  id="edit-role"
                  value={member.role}
                  onChange={(e) => onMemberChange({ role: e.target.value })}
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
                  value={member.email}
                  onChange={(e) => onMemberChange({ email: e.target.value })}
                  placeholder="Enter email address"
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={member.phone || ''}
                  onChange={(e) => onMemberChange({ phone: e.target.value })}
                  placeholder="Enter phone number"
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location" className="text-sm font-medium text-gray-700">Location</Label>
                <Input
                  id="edit-location"
                  value={member.location || ''}
                  onChange={(e) => onMemberChange({ location: e.target.value })}
                  placeholder="e.g. San Francisco, CA"
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={member.startDate}
                  onChange={(e) => onMemberChange({ startDate: e.target.value })}
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-isDeveloper" className="text-sm font-medium text-gray-700 block">Developer</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="edit-isDeveloper"
                    checked={member.isDeveloper}
                    onCheckedChange={(checked) => onMemberChange({
                      isDeveloper: checked,
                      position: checked ? 'Developer' : ''
                    })}
                  />
                  <Label htmlFor="edit-isDeveloper" className="text-sm font-normal text-gray-600">
                    Mark if user is a developer
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-position-text" className="text-sm font-medium text-gray-700">Position</Label>
                <Input
                  id="edit-position-text"
                  value={member.position || ''}
                  onChange={(e) => onMemberChange({ position: e.target.value })}
                  placeholder="e.g. HR Manager, PM, Designer"
                  className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
                  disabled={member.isDeveloper}
                />
                <p className="text-xs text-gray-500">
                  {member.isDeveloper
                    ? 'Position is set to Developer when toggle is enabled'
                    : 'Enter the position for non-developer team members'}
                </p>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label htmlFor="edit-skills" className="text-sm font-medium text-gray-700">Skills</Label>
            <Input
              id="edit-skills"
              value={Array.isArray(member.skills) ? member.skills.join(', ') : (member.skills || '')}
              onChange={(e) => {
                const value = e.target.value
                const skillsArray = value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                onMemberChange({ skills: skillsArray })
              }}
              placeholder="React, TypeScript, Node.js, PostgreSQL (comma-separated)"
              className="border-gray-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 rounded-xl"
            />
            {Array.isArray(member.skills) && member.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {member.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Separate skills with commas (e.g., "React, Node.js")</p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="edit-bio" className="text-sm font-medium text-gray-700">Bio</Label>
            <Textarea
              id="edit-bio"
              value={member.bio || ''}
              onChange={(e) => onMemberChange({ bio: e.target.value })}
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
                checked={member.isBillable}
                onCheckedChange={(checked) => onMemberChange({ isBillable: checked })}
              />
              <Label htmlFor="edit-billable" className="text-sm font-medium text-gray-700">
                Billable Resource
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status" className="text-sm font-medium text-gray-700">Status</Label>
                <Select
                  value={member.status}
                  onValueChange={(value) => onMemberChange({ status: value as 'active' | 'bench' | 'unavailable' })}
                >
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

              {member.isBillable && (
                <div className="space-y-2">
                  <Label htmlFor="edit-hourlyRate" className="text-sm font-medium text-gray-700">Hourly Rate ($)</Label>
                  <Input
                    id="edit-hourlyRate"
                    type="number"
                    value={member.hourlyRate || ''}
                    onChange={(e) => onMemberChange({ hourlyRate: e.target.value })}
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
            onClick={() => onOpenChange(false)}
            className="border-gray-200 hover:bg-gray-50 rounded-xl"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Pencil className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Updating...' : 'Update Team Member'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

