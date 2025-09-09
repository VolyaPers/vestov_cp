import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { Search, Filter, Plus, Edit, Trash2, MapPin, Code, Mail, Phone, Globe, Star } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'

interface Developer {
  id: number
  name: string
  email: string
  skills: string[]
  hourlyRate: string
  experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
  status: 'available' | 'assigned' | 'unavailable'
  bio?: string
  location?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

interface DeveloperFormData {
  name: string
  email: string
  skills: string
  hourlyRate: string
  experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
  status: 'available' | 'assigned' | 'unavailable'
  bio: string
  location: string
}

export function TeamPage() {
  const [, setLocation] = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'assigned' | 'unavailable'>('all')
  const [experienceFilter, setExperienceFilter] = useState<'all' | 'junior' | 'middle' | 'senior' | 'lead'>('all')
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDeveloper, setEditingDeveloper] = useState<Developer | null>(null)
  const [formData, setFormData] = useState<DeveloperFormData>({
    name: '',
    email: '',
    skills: '',
    hourlyRate: '',
    experienceLevel: 'middle',
    status: 'available',
    bio: '',
    location: '',
  })

  const loadDevelopers = async () => {
    try {
      setIsLoading(true)
      const response = await api.getDevelopers()
      setDevelopers(response)
    } catch (error) {
      console.error('Failed to load developers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDevelopers()
  }, [])

  const filteredDevelopers = developers.filter((dev) => {
    const matchesSearch = !searchTerm || 
      dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())) ||
      dev.location?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || dev.status === statusFilter
    const matchesExperience = experienceFilter === 'all' || dev.experienceLevel === experienceFilter
    
    return matchesSearch && matchesStatus && matchesExperience
  })

  const handleDeveloperClick = (developerId: number) => {
    setLocation(`/admin/employees/${developerId}`)
  }

  const openAddDialog = () => {
    setEditingDeveloper(null)
    setFormData({
      name: '',
      email: '',
      skills: '',
      hourlyRate: '',
      experienceLevel: 'middle',
      status: 'available',
      bio: '',
      location: '',
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (developer: Developer) => {
    setEditingDeveloper(developer)
    setFormData({
      name: developer.name,
      email: developer.email,
      skills: developer.skills.join(', '),
      hourlyRate: developer.hourlyRate,
      experienceLevel: developer.experienceLevel,
      status: developer.status,
      bio: developer.bio || '',
      location: developer.location || '',
    })
    setIsDialogOpen(true)
  }

  const handleCreateDeveloper = async () => {
    try {
      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s)
      const developerData = {
        ...formData,
        skills: skillsArray,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
      }
      
      await api.createDeveloper(developerData)
      loadDevelopers()
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create developer:', error)
    }
  }

  const handleUpdateDeveloper = async () => {
    if (!editingDeveloper) return
    
    try {
      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s)
      const developerData = {
        ...formData,
        skills: skillsArray,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
      }
      
      await api.updateDeveloper(editingDeveloper.id, developerData)
      loadDevelopers()
      setIsDialogOpen(false)
      setEditingDeveloper(null)
      resetForm()
    } catch (error) {
      console.error('Failed to update developer:', error)
    }
  }

  const handleDeleteDeveloper = async (id: number) => {
    if (!confirm('Are you sure you want to delete this developer?')) return
    
    try {
      await api.deleteDeveloper(id)
      loadDevelopers()
    } catch (error) {
      console.error('Failed to delete developer:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      skills: '',
      hourlyRate: '',
      experienceLevel: 'middle',
      status: 'available',
      bio: '',
      location: '',
    })
    setEditingDeveloper(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'unavailable': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getExperienceColor = (level: string) => {
    switch (level) {
      case 'junior': return 'bg-yellow-100 text-yellow-800'
      case 'middle': return 'bg-blue-100 text-blue-800'
      case 'senior': return 'bg-purple-100 text-purple-800'
      case 'lead': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Developers Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your development team and their skills
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Developer
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Developers</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{developers.length}</div>
            <p className="text-xs text-muted-foreground">
              Active development team
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {developers.filter(d => d.status === 'available').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {developers.filter(d => d.status === 'assigned').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently working
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Rate</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${developers.length > 0 
                ? Math.round(developers.reduce((sum, d) => sum + parseFloat(d.hourlyRate), 0) / developers.length)
                : 0}/hr
            </div>
            <p className="text-xs text-muted-foreground">
              Average hourly rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search developers, skills, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          {/* Status Filter */}
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All Status
          </Button>
          <Button
            variant={statusFilter === 'available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('available')}
          >
            Available
          </Button>
          <Button
            variant={statusFilter === 'assigned' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('assigned')}
          >
            Assigned
          </Button>
          
          {/* Experience Filter */}
          <Button
            variant={experienceFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setExperienceFilter('all')}
          >
            All Levels
          </Button>
          <Button
            variant={experienceFilter === 'junior' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setExperienceFilter('junior')}
          >
            Junior
          </Button>
          <Button
            variant={experienceFilter === 'middle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setExperienceFilter('middle')}
          >
            Middle
          </Button>
          <Button
            variant={experienceFilter === 'senior' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setExperienceFilter('senior')}
          >
            Senior
          </Button>
        </div>
      </div>

      {/* Developers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredDevelopers.map((developer) => (
          <Card 
            key={developer.id} 
            className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={developer.avatarUrl} alt={developer.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {developer.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {developer.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusColor(developer.status)}>
                        {developer.status}
                      </Badge>
                      <Badge className={getExperienceColor(developer.experienceLevel)}>
                        {developer.experienceLevel}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(developer)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteDeveloper(developer.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-3 w-3 mr-2" />
                  {developer.email}
                </div>
                {developer.location && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-3 w-3 mr-2" />
                    {developer.location}
                  </div>
                )}
              </div>

              {/* Skills */}
              {developer.skills && developer.skills.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Skills:</p>
                  <div className="flex flex-wrap gap-1">
                    {developer.skills.slice(0, 4).map((skill, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {developer.skills.length > 4 && (
                      <Badge variant="secondary" className="text-xs">
                        +{developer.skills.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Bio */}
              {developer.bio && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {developer.bio}
                  </p>
                </div>
              )}

              {/* Rate */}
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-gray-500">Hourly Rate</span>
                <span className="text-lg font-semibold text-gray-900">
                  ${developer.hourlyRate}/hr
                </span>
              </div>

              {/* View Details Button */}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => handleDeveloperClick(developer.id)}
              >
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredDevelopers.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-gray-500">
              <Code className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No developers found
              </h3>
              <p className="text-sm">
                {searchTerm || statusFilter !== 'all' || experienceFilter !== 'all'
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first developer"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Developer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDeveloper ? 'Edit Developer' : 'Add New Developer'}
            </DialogTitle>
            <DialogDescription>
              {editingDeveloper 
                ? 'Update the developer information below.'
                : 'Add a new developer to your team.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@vestov.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  placeholder="45"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ukraine"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="experienceLevel">Experience Level</Label>
                <Select
                  value={formData.experienceLevel}
                  onValueChange={(value: 'junior' | 'middle' | 'senior' | 'lead') => 
                    setFormData({ ...formData, experienceLevel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="middle">Middle</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'available' | 'assigned' | 'unavailable') => 
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="React, TypeScript, Node.js, PostgreSQL"
              />
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Brief description of the developer's background and expertise..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingDeveloper ? handleUpdateDeveloper : handleCreateDeveloper}
            >
              {editingDeveloper ? 'Update Developer' : 'Add Developer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}