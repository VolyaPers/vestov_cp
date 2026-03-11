import { useEffect, useState } from 'react'
import { Building, Calendar, Mail, Shield, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

interface UserProfile {
  id: number
  username: string
  fullName: string
  email: string
  role: string
  position?: string
  avatarUrl?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

interface ClientInfo {
  id: number
  name: string
  industry?: string
  status: string
  contractType?: string
}

const clientStatusTone = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-rose-100 text-rose-800',
} as const

export function ClientProfile() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [assignedClients, setAssignedClients] = useState<ClientInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const currentUser = await api.getCurrentUser()
        setUser(currentUser)

        const clients = await api.getClients()
        setAssignedClients(clients)
      } catch (error) {
        console.error('Failed to load profile data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfileData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <EmptyState
        icon={<User className="h-6 w-6" />}
        title="Profile not found"
        description="Unable to load your profile information right now."
      />
    )
  }

  const roleLabel = user.role.replace('_', ' ')
  const activeClients = assignedClients.filter((client) => client.status === 'active').length

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Client Workspace"
        title="Profile and access overview"
        description="Review your account identity, client access, and current portal permissions in one place."
        theme="amber"
        meta={(
          <>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              @{user.username}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 capitalize">
              {roleLabel}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {assignedClients.length} client{assignedClients.length !== 1 ? 's' : ''} assigned
            </span>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Assigned Clients"
          value={assignedClients.length}
          hint={`${activeClients} active`}
          icon={<Building className="h-5 w-5" />}
          tone="amber"
        />
        <MetricTile
          label="Role"
          value={roleLabel}
          hint={user.position || 'Client portal access'}
          icon={<Shield className="h-5 w-5" />}
          tone="primary"
        />
        <MetricTile
          label="Last Login"
          value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'No data'}
          hint={`Member since ${new Date(user.createdAt).toLocaleDateString()}`}
          icon={<Calendar className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="overflow-hidden border-white/80 bg-white/88">
          <CardContent className="p-6 sm:p-7">
            <SectionHeading
              title="Personal information"
              description="Identity and primary account metadata used across the client workspace."
              icon={<User className="h-5 w-5" />}
            />

            <div className="flex flex-col gap-6 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.6rem] bg-primary/10 text-primary shadow-[0_24px_45px_-24px_hsl(var(--primary)/0.6)]">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-9 w-9" />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl font-semibold text-foreground">{user.fullName}</h2>
                  <Badge className="capitalize">{roleLabel}</Badge>
                  {!user.isActive && <Badge variant="outline">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{user.position || 'Client portal contact'}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Mail className="h-4 w-4 text-primary" />
                  Email
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  Portal role
                </div>
                <p className="mt-2 text-sm capitalize text-muted-foreground">{roleLabel}</p>
              </div>
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  Member since
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  Last login
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'No login recorded'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/88">
          <CardContent className="p-6 sm:p-7">
            <SectionHeading
              title="Client access"
              description="Companies and portals currently available through this account."
              icon={<Building className="h-5 w-5" />}
            />

            {assignedClients.length > 0 ? (
              <div className="space-y-3">
                {assignedClients.map((client) => (
                  <div
                    key={client.id}
                    className="rounded-[1.2rem] border border-border/70 bg-muted/20 p-4 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.35)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{client.name}</p>
                        {client.industry && (
                          <p className="mt-1 text-sm text-muted-foreground">{client.industry}</p>
                        )}
                      </div>
                      <Badge
                        className={client.status in clientStatusTone
                          ? clientStatusTone[client.status as keyof typeof clientStatusTone]
                          : 'bg-amber-100 text-amber-800'}
                      >
                        {client.status}
                      </Badge>
                    </div>

                    {client.contractType && (
                      <div className="mt-3">
                        <Badge variant="outline" className="capitalize">
                          {client.contractType}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Building className="h-6 w-6" />}
                title="No client access assigned"
                description="Client workspaces will appear here once access is granted."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/80 bg-white/88">
        <CardContent className="p-6 sm:p-7">
          <SectionHeading
            title="Access posture"
            description="A high-level summary of the current account state for this portal."
            icon={<Shield className="h-5 w-5" />}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.2rem] border border-emerald-200/80 bg-emerald-50/90 p-5">
              <p className="text-sm font-semibold text-emerald-900">Account status</p>
              <p className="mt-2 font-display text-2xl font-semibold text-emerald-950">
                {user.isActive ? 'Active' : 'Inactive'}
              </p>
              <p className="mt-2 text-sm text-emerald-700">
                {user.isActive ? 'Portal access is enabled.' : 'Contact admin to restore access.'}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-sky-200/80 bg-sky-50/90 p-5">
              <p className="text-sm font-semibold text-sky-900">Access model</p>
              <p className="mt-2 font-display text-2xl font-semibold text-sky-950">Client</p>
              <p className="mt-2 text-sm text-sky-700">Focused on visibility, approvals, and collaboration.</p>
            </div>
            <div className="rounded-[1.2rem] border border-violet-200/80 bg-violet-50/90 p-5">
              <p className="text-sm font-semibold text-violet-900">Coverage</p>
              <p className="mt-2 font-display text-2xl font-semibold text-violet-950">
                {assignedClients.length} workspace{assignedClients.length !== 1 ? 's' : ''}
              </p>
              <p className="mt-2 text-sm text-violet-700">Access spans every assigned client portal.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
