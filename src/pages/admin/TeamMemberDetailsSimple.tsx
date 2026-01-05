import { useState, useEffect } from 'react'
import { useRoute, Link } from 'wouter'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { TeamMember } from '@/types/common'

export function TeamMemberDetailsSimple() {
  const [match, params] = useRoute('/admin/team-detail/:id')
  const [member, setMember] = useState<TeamMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (!hasRouteParam(params, 'id')) {
    return <div>Member ID not found</div>
  }
  const memberId = getRouteParam(params, 'id')

  useEffect(() => {
    const loadMember = async () => {
      try {
        const data = await api.getTeamMember(memberId)
        setMember(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team member')
      } finally {
        setIsLoading(false)
      }
    }

    loadMember()
  }, [memberId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/team">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <div className="mt-8 text-center">
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/team">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <div className="mt-8 text-center">
            <p className="text-red-500">Error: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/team">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <div className="mt-8 text-center">
            <p className="text-gray-500">Team member not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/admin/team">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Team
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{member.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {member.position && (
              <div>
                <p className="text-sm font-medium text-gray-500">Position</p>
                <p className="text-lg">{member.position}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-lg">{member.email}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <p className="text-lg capitalize">{member.status}</p>
            </div>

            {member.location && (
              <div>
                <p className="text-sm font-medium text-gray-500">Location</p>
                <p className="text-lg">{member.location}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
