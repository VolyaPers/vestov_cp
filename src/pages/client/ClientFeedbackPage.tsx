import { useEffect, useState } from 'react'
import {
  Briefcase,
  Calendar,
  Check,
  MessageSquare,
  Send,
  Star,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

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
      loadDevelopers(parseInt(selectedServiceId, 10))
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

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
        clientServiceId: selectedServiceId && selectedServiceId !== 'none' ? parseInt(selectedServiceId, 10) : undefined,
        teamMemberId: selectedDeveloperId && selectedDeveloperId !== 'none' ? parseInt(selectedDeveloperId, 10) : undefined,
        rating,
        comments: comments.trim(),
        feedbackType: selectedDeveloperId && selectedDeveloperId !== 'none' ? 'team_member' : 'general',
      })

      setSelectedServiceId('')
      setSelectedDeveloperId('')
      setRating(0)
      setComments('')

      await loadData()
      showAlert({ message: 'Thank you for your feedback!', type: 'success' })
    } catch (error) {
      console.error('Error submitting feedback:', error)
      showAlert({ message: 'Failed to submit feedback. Please try again.', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStars = (currentRating: number, interactive = false, size: 'sm' | 'md' = 'md') => {
    const starClass = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={interactive ? () => setRating(star) : undefined}
            disabled={!interactive}
            className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
          >
            <Star
              className={`${starClass} ${star <= currentRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
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
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  const respondedCount = feedbacks.filter((feedback) => feedback.status === 'reviewed').length
  const averageRating = feedbacks.length
    ? (feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) / feedbacks.length).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Client Experience"
        title="Feedback loop with your delivery team"
        description="Send structured feedback, rate work quality, and track responses from Vestov operations in one stream."
        theme="teal"
        meta={(
          <>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {services.length} service{services.length !== 1 ? 's' : ''} available
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {feedbacks.length} feedback thread{feedbacks.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Submitted"
          value={feedbacks.length}
          hint="All historical entries"
          icon={<MessageSquare className="h-5 w-5" />}
          tone="primary"
        />
        <MetricTile
          label="Responded"
          value={respondedCount}
          hint={`${feedbacks.length - respondedCount} still open`}
          icon={<Check className="h-5 w-5" />}
          tone="emerald"
        />
        <MetricTile
          label="Average Rating"
          value={averageRating}
          hint="Across submitted feedback"
          icon={<Star className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <Card className="border-white/80 bg-white/88">
          <CardContent className="p-6 sm:p-7">
            <SectionHeading
              title="Submit feedback"
              description="Tie feedback to a service or teammate, or keep it general."
              icon={<Send className="h-5 w-5" />}
            />

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="service">Service</Label>
                  <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" label="General Feedback">
                        General Feedback
                      </SelectItem>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id.toString()} label={service.serviceTitle}>
                          {service.serviceTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="developer">Team Member</Label>
                  {!selectedServiceId || selectedServiceId === 'none' || loadingDevelopers ? (
                    <div className="mt-2 flex h-11 w-full items-center justify-between rounded-xl border border-border/70 bg-muted/35 px-3 text-sm text-muted-foreground">
                      {loadingDevelopers ? 'Loading team members...' : 'Select a service first'}
                    </div>
                  ) : (
                    <Select value={selectedDeveloperId} onValueChange={setSelectedDeveloperId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select a team member..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" label="No specific person">
                          No specific person
                        </SelectItem>
                        {developers.map((developer) => (
                          <SelectItem key={developer.id} value={developer.id.toString()} label={developer.fullName}>
                            {developer.fullName} ({developer.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-border/70 bg-muted/20 p-4">
                <Label>Rating</Label>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {renderStars(rating, true)}
                  <p className="text-sm text-muted-foreground">
                    {rating > 0 ? `${rating}/5 selected` : 'Choose a rating before submitting'}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="comments">Your Feedback</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  placeholder="What is working well, where are you seeing friction, and what should improve?"
                  rows={6}
                  className="mt-2"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Feedback can be general, service-specific, or attached to a teammate.
                </p>
                <Button type="submit" disabled={isSubmitting || rating === 0 || !comments.trim()}>
                  {isSubmitting ? 'Submitting...' : 'Submit feedback'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/88">
          <CardContent className="p-6 sm:p-7">
            <SectionHeading
              title="How responses work"
              description="What to expect after your feedback is sent."
              icon={<MessageSquare className="h-5 w-5" />}
            />

            <div className="space-y-3">
              <div className="rounded-[1.2rem] border border-border/70 bg-slate-950 p-5 text-white">
                <p className="text-sm font-semibold text-white/90">Direct visibility</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Vestov operations reviews incoming feedback and can respond directly inside the same thread.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-muted/20 p-5">
                <p className="text-sm font-semibold text-foreground">Service context</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Link feedback to a service or specific teammate when the request needs targeted follow-up.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-muted/20 p-5">
                <p className="text-sm font-semibold text-foreground">Clear status tracking</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Each feedback item moves from pending review to responded once the team closes the loop.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/80 bg-white/88">
        <CardContent className="p-6 sm:p-7">
          <SectionHeading
            title="Submitted feedback"
            description="Historical entries and responses from the team."
            icon={<MessageSquare className="h-5 w-5" />}
          />

          {feedbacks.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="No feedback yet"
              description="Use the form above to start the first feedback thread."
            />
          ) : (
            <div className="space-y-4">
              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="rounded-[1.35rem] border border-border/70 bg-muted/15 p-5 shadow-[0_26px_50px_-38px_rgba(15,23,42,0.4)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {feedback.service ? (
                          <Badge className="bg-primary text-white">
                            <Briefcase className="mr-1 h-3 w-3" />
                            {feedback.service.serviceTitle}
                          </Badge>
                        ) : (
                          <Badge className="bg-primary text-white">
                            <MessageSquare className="mr-1 h-3 w-3" />
                            General Feedback
                          </Badge>
                        )}

                        {feedback.teamMember && (
                          <Badge variant="outline">
                            <User className="mr-1 h-3 w-3" />
                            {feedback.teamMember.fullName}
                          </Badge>
                        )}

                        <Badge
                          className={feedback.status === 'reviewed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'}
                        >
                          {feedback.status === 'reviewed' ? 'Responded' : 'Pending'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        {renderStars(feedback.rating, false, 'sm')}
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(feedback.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.1rem] border border-border/60 bg-white/85 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{feedback.comments}</p>
                  </div>

                  {feedback.adminResponse && (
                    <div className="mt-4 rounded-[1.1rem] border border-sky-200/80 bg-sky-50/80 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-sky-900">Response from team</p>
                        {feedback.adminRespondedAt && (
                          <span className="text-xs text-sky-700">{formatDate(feedback.adminRespondedAt)}</span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-sky-900">
                        {feedback.adminResponse}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
