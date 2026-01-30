import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Star,
  User,
  Briefcase,
  Calendar,
  Send,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useCustomAlert } from '@/components/ui/custom-alert'

interface Service {
  id: number
  clientId: number
  clientName: string
  serviceTitle: string
  serviceCategory: string
}

interface Developer {
  id: number
  fullName: string
  role: string
  avatarUrl: string | null
}

interface Feedback {
  id: number
  rating: number
  comments: string
  feedbackType: string
  status: string
  createdAt: string
  adminResponse: string | null
  adminRespondedAt: string | null
  service: { id: number; serviceTitle: string } | null
  teamMember: { id: number; fullName: string } | null
}

export function ClientFeedbackPage() {
  const { showAlert } = useCustomAlert()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>('')
  const [rating, setRating] = useState<number>(0)
  const [comments, setComments] = useState('')
  const [loadingDevelopers, setLoadingDevelopers] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedServiceId && selectedServiceId !== 'none') {
      loadDevelopers(parseInt(selectedServiceId))
    } else {
      setDevelopers([])
      setSelectedDeveloperId('')
    }
  }, [selectedServiceId])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [feedbacksData, servicesData] = await Promise.all([
        api.getClientFeedbacks(),
        api.getFeedbackClientServices(),
      ])
      setFeedbacks(feedbacksData.feedbacks)
      setServices(servicesData.services)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadDevelopers = async (serviceId: number) => {
    try {
      setLoadingDevelopers(true)
      const data = await api.getFeedbackServiceDevelopers(serviceId)
      setDevelopers(data.developers)
    } catch (error) {
      console.error('Error loading developers:', error)
      setDevelopers([])
    } finally {
      setLoadingDevelopers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      showAlert({ message: 'Please select a rating', type: 'warning' })
      return
    }

    if (!comments.trim()) {
      showAlert({ message: 'Please enter your feedback', type: 'warning' })
      return
    }

    try {
      setIsSubmitting(true)
      await api.submitFeedback({
        clientServiceId: selectedServiceId && selectedServiceId !== 'none' ? parseInt(selectedServiceId) : undefined,
        teamMemberId: selectedDeveloperId && selectedDeveloperId !== 'none' ? parseInt(selectedDeveloperId) : undefined,
        rating,
        comments: comments.trim(),
        feedbackType: selectedDeveloperId && selectedDeveloperId !== 'none' ? 'team_member' : 'general',
      })

      // Reset form
      setSelectedServiceId('')
      setSelectedDeveloperId('')
      setRating(0)
      setComments('')

      // Reload feedbacks
      await loadData()

      showAlert({ message: 'Thank you for your feedback!', type: 'success' })
    } catch (error) {
      console.error('Error submitting feedback:', error)
      showAlert({ message: 'Failed to submit feedback. Please try again.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStars = (currentRating: number, interactive: boolean = false) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={interactive ? () => setRating(star) : undefined}
            disabled={!interactive}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          >
            <Star
              className={`h-6 w-6 ${star <= currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          </button>
        ))}
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Feedback
            </h1>
            <p className="stripe-text-secondary text-lg">
              Share your experience and view responses
            </p>
          </div>
        </div>
      </div>

      {/* Submit Feedback Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Submit Feedback
          </CardTitle>
          <CardDescription>
            We value your feedback! Let us know how we can improve our services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Service Select */}
              <div>
                <Label htmlFor="service">Service (optional)</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" label="General Feedback">General Feedback</SelectItem>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id.toString()} label={service.serviceTitle}>
                        {service.serviceTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Developer Select */}
              <div>
                <Label htmlFor="developer">Team Member (optional)</Label>
                {(!selectedServiceId || selectedServiceId === 'none' || loadingDevelopers) ? (
                  <div className="mt-1">
                    <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
                      {loadingDevelopers ? 'Loading...' : 'Select a service first'}
                    </div>
                  </div>
                ) : (
                  <Select
                    value={selectedDeveloperId}
                    onValueChange={setSelectedDeveloperId}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" label="No specific person">No specific person</SelectItem>
                      {developers.map(dev => (
                        <SelectItem key={dev.id} value={dev.id.toString()} label={dev.fullName}>
                          {dev.fullName} ({dev.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Rating */}
            <div>
              <Label>Rating *</Label>
              <div className="mt-2">
                {renderStars(rating, true)}
              </div>
            </div>

            {/* Comments */}
            <div>
              <Label htmlFor="comments">Your Feedback *</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Tell us about your experience..."
                rows={4}
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={isSubmitting || rating === 0 || !comments.trim()}>
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Feedbacks */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Submitted Feedbacks</h2>

        {feedbacks.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No feedbacks yet</h3>
                <p className="text-gray-500">
                  You haven't submitted any feedback yet. Use the form above to share your experience.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {feedbacks.map(feedback => (
              <Card key={feedback.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {feedback.service ? (
                        <Badge className="text-xs bg-primary text-white">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {feedback.service.serviceTitle}
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-primary text-white">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          General Feedback
                        </Badge>
                      )}
                      {feedback.teamMember && (
                        <Badge variant="outline" className="text-xs">
                          <User className="h-3 w-3 mr-1" />
                          {feedback.teamMember.fullName}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant={feedback.status === 'reviewed' ? 'default' : 'secondary'}
                      className={feedback.status === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                    >
                      {feedback.status === 'reviewed' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Responded
                        </>
                      ) : (
                        'Pending'
                      )}
                    </Badge>
                  </div>

                  {/* Rating and Date */}
                  <div className="flex items-center gap-4 mb-3">
                    {renderStars(feedback.rating)}
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(feedback.createdAt)}
                    </span>
                  </div>

                  {/* Comment */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{feedback.comments}</p>
                  </div>

                  {/* Admin Response */}
                  {feedback.adminResponse && (
                    <div className="border-l-4 border-blue-500 pl-4 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-blue-600">Response from Team</span>
                        {feedback.adminRespondedAt && (
                          <span className="text-xs text-gray-400">
                            {formatDate(feedback.adminRespondedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{feedback.adminResponse}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
