import { Link, useLocation } from 'wouter'
import {
  BriefcaseBusiness,
  Building2,
  LogOut,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlobalSearchLauncher } from '@/components/GlobalSearchLauncher'
import { UserImpersonation } from '@/components/UserImpersonation'
import { ShiftWidget } from '@/components/ShiftWidget'
import vestovLogo from '@/assets/vestov-logo.png'
import { getNavigation } from '@/lib/navigation'
import type { User as UserType, Client } from '@/types/common'

// Role subtitles
const roleSubtitles: Record<string, string> = {
  admin: 'Admin Dashboard',
  team_member: 'Employee Portal',
  client: 'Client Portal',
}

// Props interface
export interface SidebarProps {
  role: 'admin' | 'team_member' | 'client'
  user?: UserType
  onLogout: () => void
  currentClient?: Client | null
}

const roleThemes = {
  admin: {
    icon: ShieldCheck,
    iconSurface: 'border-sky-200/80 bg-sky-50/88 text-sky-700',
  },
  team_member: {
    icon: BriefcaseBusiness,
    iconSurface: 'border-emerald-200/80 bg-emerald-50/88 text-emerald-700',
  },
  client: {
    icon: Building2,
    iconSurface: 'border-amber-200/80 bg-amber-50/88 text-amber-700',
  },
} as const

export function Sidebar({ role, user, onLogout, currentClient }: SidebarProps) {
  const [location] = useLocation()
  const theme = roleThemes[role]
  const ThemeIcon = theme.icon

  // Get navigation based on role
  const navigation = getNavigation(role, currentClient)
  const navigationGroups = navigation.reduce<Array<{ title: string; items: typeof navigation }>>((groups, item) => {
    const section = item.section || 'Workspace'
    const existingGroup = groups.find((group) => group.title === section)

    if (existingGroup) {
      existingGroup.items.push(item)
    } else {
      groups.push({ title: section, items: [item] })
    }

    return groups
  }, [])

  const showImpersonation = role === 'admin' || user?.isImpersonating

  return (
    <div className="relative flex min-h-full flex-col overflow-visible border-r border-slate-200 bg-white lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="border-b border-slate-200 px-3 pb-3 pt-3 lg:px-4 lg:pb-4 lg:pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[0.55rem] border border-slate-200 bg-white">
            <img src={vestovLogo} alt="Vestov Logo" className="h-6 w-auto" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">Vestov</h1>
          </div>
          <div className="ml-auto flex items-center gap-1 text-slate-400">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded-[0.55rem] border border-slate-200 bg-slate-50', theme.iconSurface)}>
              <ThemeIcon className="h-3 w-3" />
            </div>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="mt-3 lg:hidden">
          <GlobalSearchLauncher className="sidebar-search-launcher w-full border-slate-200 bg-slate-50" />
        </div>
      </div>

      <div className="px-2 py-3 lg:flex-1 lg:overflow-y-auto lg:px-2.5 lg:py-4">
        <div className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-1.5 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.title}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  if (item.external) {
                    return (
                      <a
                        key={item.name}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="stripe-nav-item no-underline hover:no-underline"
                      >
                        <item.icon
                          className="mr-3 h-4 w-4 flex-shrink-0 transition-colors text-[var(--stripe-text-tertiary)]"
                          aria-hidden="true"
                        />
                        <span className="flex-1">{item.name}</span>
                        <ExternalLink className="h-4 w-4 text-[var(--stripe-text-tertiary)] opacity-70" />
                      </a>
                    )
                  }

                  const isActive = location === item.href || location.startsWith(item.href + '/')
                  return (
                    <Link key={item.name} href={item.href} className="stripe-nav-link block no-underline hover:no-underline">
                      <div className={cn(
                        'stripe-nav-item',
                        isActive && 'stripe-nav-item-active'
                      )}>
                        <div className={cn(
                          'mr-3 flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150',
                          !isActive && 'text-[var(--stripe-text-tertiary)]'
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1 font-medium">{item.name}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-200 bg-white p-3">
        {role === 'team_member' && (
          <div className="rounded-[0.8rem] border border-slate-200 bg-white p-3">
            <ShiftWidget />
          </div>
        )}

        {showImpersonation && (
          <UserImpersonation
            currentUser={user}
            onImpersonate={async () => {
              // API handles impersonation and reloads page
            }}
            onStopImpersonation={async () => {
              // API handles stop impersonation and reloads page
            }}
          />
        )}

        {user && (
          <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start gap-3">
              {role === 'admin' ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-slate-900 text-xs font-bold text-white">
                  {user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'AD'}
                </div>
              ) : (
                <Avatar className="h-8 w-8 border border-slate-200">
                  <AvatarImage src={(user as any).avatarUrl} alt={user.fullName || user.username} />
                  <AvatarFallback className="bg-primary/12 text-primary text-sm font-semibold">
                    {(user.fullName || user.username)
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{user.fullName || user.username || 'User'}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {role === 'admin' ? (user.role || 'Administrator') :
                       role === 'team_member' ? ((user as any).position || 'Team Member') :
                       'Client access'}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onLogout}
                    className="h-8 w-8 rounded-[0.6rem] border-border bg-white"
                    title="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-200 bg-white text-muted-foreground">
                    {roleSubtitles[role]}
                  </Badge>
                  {user.isImpersonating && (
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive">
                      Impersonation
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
