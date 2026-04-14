import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Star,
  User,
  Building2,
  Briefcase,
  Calendar,
  Send,
  Trash2,
  Search,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'
import { EmptyState, PageHero } from '@/components/page-primitives'

interface Feedback {
  id: number
  rating: number
  comments: string
  feedbackType: string
  status: string
  createdAt: string
  adminResponse: string | null
  adminRespondedAt: string | null
  client: { id: number; name: string } | null
  service: { id: number; serviceTitle: string } | null
  teamMember: { id: number; fullName: string } | null
  submittedBy: { id: number; fullName: string }
}

export function AdminFeedbackPage() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')

  // Dialog states
  const [isRespondDialogOpen, setIsRespondDialogOpen] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadFeedbacks()
  }, [])

  const loadFeedbacks = async () => {
    try {
      setIsLoading(true)
      const data = await api.getAdminFeedbacks()
      setFeedbacks(data.feedbacks)
    } catch (error) {
      console.error('Error loading feedbacks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenRespondDialog = (feedback: Feedback) => {
    setSelectedFeedback(feedback)
    setAdminResponse(feedback.adminResponse || '')
    setIsRespondDialogOpen(true)
  }

  const handleRespond = async () => {
    if (!selectedFeedback || !adminResponse.trim()) return

    try {
      setIsSaving(true)
      await api.respondToFeedback(selectedFeedback.id, adminResponse.trim())
      await loadFeedbacks()
      setIsRespondDialogOpen(false)
      setSelectedFeedback(null)
      setAdminResponse('')
    } catch (error) {
      console.error('Error responding to feedback:', error)
      showAlert({ message: 'Failed to send response', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (feedback: Feedback) => {
    const confirmed = await showConfirm({
      title: 'Delete Feedback',
      message: `Are you sure you want to delete this feedback from ${feedback.submittedBy.fullName}?`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.deleteFeedback(feedback.id)
      await loadFeedbacks()
    } catch (error) {
      console.error('Error deleting feedback:', error)
      showAlert({ message: 'Failed to delete feedback', type: 'error' })
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get unique clients for filter
  const uniqueClients = Array.from(
    new Set(feedbacks.filter(f => f.client).map(f => JSON.stringify(f.client)))
  ).map(s => JSON.parse(s) as { id: number; name: string })

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter(feedback => {
    // Status filter
    if (statusFilter !== 'all' && feedback.status !== statusFilter) return false

    // Client filter
    if (clientFilter !== 'all' && feedback.client?.id.toString() !== clientFilter) return false

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesComment = feedback.comments?.toLowerCase().includes(query)
      const matchesClient = feedback.client?.name?.toLowerCase().includes(query)
      const matchesService = feedback.service?.serviceTitle?.toLowerCase().includes(query)
      const matchesTeamMember = feedback.teamMember?.fullName?.toLowerCase().includes(query)
      const matchesSubmitter = feedback.submittedBy?.fullName?.toLowerCase().includes(query)

      if (!matchesComment && !matchesClient && !matchesService && !matchesTeamMember && !matchesSubmitter) {
        return false
      }
    }

    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-300/70" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Feedback Management"
        title="Client sentiment and response workflow in one place."
        description="Feedback now lives inside the same upgraded UI system, with cleaner filters and less visual friction around response handling."
        theme="teal"
        meta={
          <>
            <span>{feedbacks.length} total feedback items</span>
            <span className="h-1 w-1 rounded-full bg-slate-400"></span>
            <span>{filteredFeedbacks.length} currently visible</span>
          </>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search feedbacks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label="All Status">All Status</SelectItem>
                  <SelectItem value="pending" label="Pending">Pending</SelectItem>
                  <SelectItem value="reviewed" label="Reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label="All Clients">All Clients</SelectItem>
                  {uniqueClients.map(client => (
                    <SelectItem key={client.id} value={client.id.toString()} label={client.name}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedbacks List */}
      {filteredFeedbacks.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="No feedbacks found"
              description={feedbacks.length === 0
                ? 'No feedback has been submitted yet.'
                : 'No feedbacks match your current filters.'}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredFeedbacks.map(feedback => (
            <Card key={feedback.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {feedback.client && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{feedback.client.name}</span>
                      </div>
                    )}
                    {feedback.service && (
                      <Badge variant="secondary" className="text-xs">
                        <Briefcase className="h-3 w-3 mr-1" />
                        {feedback.service.serviceTitle}
                      </Badge>
                    )}
                    {feedback.teamMember && (
                      <Badge variant="outline" className="text-xs">
                        <User className="h-3 w-3 mr-1" />
                        For: {feedback.teamMember.fullName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={feedback.status === 'reviewed' ? 'default' : 'secondary'}
                      className={feedback.status === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                    >
                      {feedback.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(feedback)}
                      className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                      title="Delete this feedback"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Rating and Date */}
                <div className="flex items-center gap-4 mb-3">
                  {renderStars(feedback.rating)}
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(feedback.createdAt)}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {feedback.submittedBy.fullName}
                  </span>
                </div>

                {/* Comment */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{feedback.comments}</p>
                </div>

                {/* Admin Response Section */}
                {feedback.adminResponse ? (
                  <div className="border-l-4 border-blue-500 pl-4 mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-600">Admin Response</span>
                      {feedback.adminRespondedAt && (
                        <span className="text-xs text-gray-400">
                          {formatDate(feedback.adminRespondedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{feedback.adminResponse}</p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRespondDialog(feedback)}
                    className="mt-2"
                    title="Respond to this feedback"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Respond
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Respond Dialog */}
      <Dialog open={isRespondDialogOpen} onOpenChange={setIsRespondDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Respond to Feedback</DialogTitle>
            <DialogDescription>
              Write your response to this feedback. The client will be able to see your response.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* Original Feedback Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    {selectedFeedback.submittedBy.fullName}
                  </span>
                  {renderStars(selectedFeedback.rating)}
                </div>
                <p className="text-sm text-gray-700">{selectedFeedback.comments}</p>
              </div>

              {/* Response Input */}
              <div>
                <Label htmlFor="adminResponse">Your Response</Label>
                <Textarea
                  id="adminResponse"
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Write your response here..."
                  rows={4}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRespondDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRespond} disabled={isSaving || !adminResponse.trim()}>
              {isSaving ? 'Sending...' : 'Send Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
