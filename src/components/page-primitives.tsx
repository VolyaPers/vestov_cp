import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const heroThemes = {
  ocean: 'border-blue-200/70 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(255,255,255,0.98))]',
  teal: 'border-emerald-200/70 bg-[linear-gradient(180deg,rgba(246,252,250,0.98),rgba(255,255,255,0.98))]',
  violet: 'border-indigo-200/70 bg-[linear-gradient(180deg,rgba(248,248,255,0.98),rgba(255,255,255,0.98))]',
  amber: 'border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(255,255,255,0.98))]',
} as const

const metricThemes = {
  primary: 'border border-blue-200/80 bg-blue-50 text-blue-700',
  emerald: 'border border-emerald-200/80 bg-emerald-50 text-emerald-700',
  amber: 'border border-amber-200/80 bg-amber-50 text-amber-700',
  rose: 'border border-rose-200/80 bg-rose-50 text-rose-700',
  violet: 'border border-violet-200/80 bg-violet-50 text-violet-700',
  slate: 'border border-slate-200/80 bg-slate-100 text-slate-700',
} as const

interface PageHeroProps {
  eyebrow: string
  title: string
  description: string
  meta?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  children?: ReactNode
  theme?: keyof typeof heroThemes
}

export function PageHero({
  eyebrow,
  title,
  description,
  meta,
  actions,
  aside,
  children,
  theme = 'ocean',
}: PageHeroProps) {
  return (
    <Card className={cn('overflow-hidden border bg-white text-foreground shadow-none', heroThemes[theme])}>
      <CardContent className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-7">
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-8">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[2.35rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
              {description}
            </p>
            {meta && (
              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground sm:mt-5 sm:gap-3 sm:text-sm">
                {meta}
              </div>
            )}
          </div>

          {(actions || aside) && (
            <div className="flex w-full flex-col gap-3 xl:max-w-md xl:items-end xl:self-start">
              {actions && <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap xl:justify-end">{actions}</div>}
              {aside}
            </div>
          )}
        </div>

        {children && <div className="mt-5 border-t border-border/70 pt-5 sm:mt-6 sm:pt-6">{children}</div>}
      </CardContent>
    </Card>
  )
}

interface MetricTileProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  trend?: ReactNode
  icon?: ReactNode
  tone?: keyof typeof metricThemes
  className?: string
}

export function MetricTile({
  label,
  value,
  hint,
  trend,
  icon,
  tone = 'primary',
  className,
}: MetricTileProps) {
  return (
    <Card className={cn('h-full border border-border/80 shadow-none', className)}>
      <CardContent className="flex h-full flex-col gap-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <div className="flex min-h-[2.75rem] items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] leading-4 text-muted-foreground">{label}</p>
          </div>
          {icon && (
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', metricThemes[tone])}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-end">
          <p className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[1.95rem]">{value}</p>
          {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
          {trend && <div className="mt-3">{trend}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

interface SectionHeadingProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function SectionHeading({ title, description, icon, action }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-slate-50 text-primary">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-foreground sm:text-[1.15rem]">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-6 text-center sm:p-8">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border/80 bg-white text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-lg font-semibold text-foreground sm:text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface SkeletonLineProps {
  className?: string
}

function SkeletonLine({ className }: SkeletonLineProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />
}

export function PageHeroSkeleton() {
  return (
    <Card className="overflow-hidden border bg-white text-foreground shadow-none border-blue-200/70 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(255,255,255,0.98))]">
      <CardContent className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-7">
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-8">
          <div className="max-w-3xl">
            <SkeletonLine className="h-3 w-28 rounded-full" />
            <SkeletonLine className="mt-3 h-10 w-3/5 rounded-xl sm:h-12" />
            <div className="mt-3 space-y-2">
              <SkeletonLine className="h-4 w-full max-w-2xl" />
              <SkeletonLine className="h-4 w-5/6 max-w-xl" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5 sm:mt-5 sm:gap-3">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:max-w-md xl:items-end xl:self-start">
            <div className="grid w-full gap-2 sm:grid-cols-2 sm:gap-3 xl:justify-end">
              <Skeleton className="h-11 w-full rounded-[1rem]" />
              <Skeleton className="h-11 w-full rounded-[1rem]" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="rounded-[1.3rem] border border-border/80 bg-white/65 p-4">
                <SkeletonLine className="h-3 w-24 rounded-full" />
                <SkeletonLine className="mt-3 h-6 w-20 rounded-lg" />
                <SkeletonLine className="mt-2 h-4 w-3/4 rounded-lg" />
              </div>
              <div className="rounded-[1.3rem] border border-border/80 bg-white/65 p-4">
                <SkeletonLine className="h-3 w-24 rounded-full" />
                <SkeletonLine className="mt-3 h-6 w-24 rounded-lg" />
                <SkeletonLine className="mt-2 h-4 w-2/3 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricTileSkeleton() {
  return (
    <Card className="h-full border border-border/80 shadow-none">
      <CardContent className="flex h-full flex-col gap-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <div className="flex min-h-[2.75rem] items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-3.5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        </div>

        <div className="flex flex-1 flex-col justify-end">
          <SkeletonLine className="h-8 w-28 rounded-xl" />
          <SkeletonLine className="mt-2 h-4 w-32 rounded-full" />
          <Skeleton className="mt-3 h-6 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function CardSkeleton({
  titleWidth = 'w-40',
  lines = 3,
  tall = false,
}: {
  titleWidth?: string
  lines?: number
  tall?: boolean
}) {
  return (
    <Card className="content-auto border border-border/80 shadow-none">
      <CardContent className={cn('space-y-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5', tall && 'min-h-[18rem]')}>
        <div className="space-y-2">
          <SkeletonLine className={cn('h-5 rounded-full', titleWidth)} />
          <SkeletonLine className="h-4 w-3/5 rounded-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, index) => (
            <SkeletonLine
              key={index}
              className={cn('h-4 rounded-full', index === lines - 1 ? 'w-4/5' : 'w-full')}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WorkspaceShellSkeleton({
  roleLabel,
  title,
  sidebarLines = 5,
}: {
  roleLabel: string
  title: string
  sidebarLines?: number
}) {
  return (
    <div className="app-shell min-h-screen" aria-label={`${roleLabel} loading skeleton`}>
      <div className="fixed inset-y-0 left-0 z-30 hidden w-[220px] xl:w-[232px] lg:block">
        <div className="flex h-full flex-col border-r border-slate-200 bg-white/90 px-4 py-5">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="mt-5 h-10 w-full rounded-[1rem]" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: sidebarLines }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  'h-10 w-full rounded-[0.95rem]',
                  index === 0 ? 'w-5/6' : index === 1 ? 'w-4/5' : ''
                )}
              />
            ))}
          </div>
          <div className="mt-auto space-y-3 border-t border-slate-200 pt-4">
            <Skeleton className="h-10 w-full rounded-[0.95rem]" />
            <Skeleton className="h-10 w-full rounded-[0.95rem]" />
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-col lg:pl-[220px] xl:pl-[232px]">
        <header className="sticky top-0 z-20">
          <div className="mobile-top-chrome lg:hidden">
            <div className="mobile-top-chrome-main">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-6 w-44 rounded-full" />
              </div>
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="px-4 pb-4">
              <Skeleton className="h-11 w-full rounded-full" />
            </div>
          </div>

          <div className="hidden workspace-topbar lg:block">
            <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-6 py-3 xl:px-8">
              <Skeleton className="h-11 max-w-[340px] flex-1 rounded-full" />
              <div className="ml-auto flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mobile-page-pad mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-5 xl:px-10">
            <div className="mx-auto max-w-[1500px] space-y-5 sm:space-y-6">
              <Card className="overflow-hidden border bg-white text-foreground shadow-none border-blue-200/70 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(255,255,255,0.98))]">
                <CardContent className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-7">
                  <div className="space-y-3">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-9 w-2/5 rounded-xl" />
                    <Skeleton className="h-4 w-3/5 rounded-full" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-28 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <MetricTileSkeleton key={index} />
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <CardSkeleton titleWidth="w-40" lines={4} tall />
                <CardSkeleton titleWidth="w-44" lines={4} tall />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <CardSkeleton titleWidth="w-36" lines={5} tall />
                <CardSkeleton titleWidth="w-32" lines={4} tall />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export function WorkspaceRouteSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5 sm:space-y-6">
      <PageHeroSkeleton />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricTileSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <CardSkeleton titleWidth="w-40" lines={4} tall />
        <CardSkeleton titleWidth="w-44" lines={4} tall />
      </div>
    </div>
  )
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <Card className="border border-border/80 shadow-none">
      <CardContent className="px-0 pb-0 pt-0">
        <div className="overflow-hidden">
          <div className="grid gap-3 border-b border-border/70 px-4 py-4 sm:px-5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-3 rounded-full" />
            ))}
          </div>
          <div className="space-y-0">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:px-5"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columns }).map((_, columnIndex) => (
                  <Skeleton
                    key={columnIndex}
                    className={cn(
                      'h-4 rounded-full',
                      columnIndex === 0 ? 'w-4/5' : columnIndex === columns - 1 ? 'w-2/3' : 'w-full'
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
