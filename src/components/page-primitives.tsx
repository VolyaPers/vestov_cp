import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PageHeroProps {
  eyebrow: string
  title: string
  description: string
  meta?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  children?: ReactNode
  theme?: 'ocean' | 'teal' | 'violet' | 'amber'
}

export function PageHero({
  title,
  description,
  meta,
  actions,
  aside,
  children,
}: PageHeroProps) {
  return (
    <section className="page-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {aside && <div className="page-heading-context mt-5 border-t pt-4">{aside}</div>}
      {children && <div className="mt-5 border-t pt-4">{children}</div>}
    </section>
  )
}

interface MetricTileProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  trend?: ReactNode
  icon?: ReactNode
  tone?: 'primary' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate'
  className?: string
}

export function MetricTile({
  label,
  value,
  hint,
  trend,
  className,
}: MetricTileProps) {
  return (
    <div className={cn('metric-tile min-w-0 border-b py-5', className)}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>}
      {trend && <div className="mt-3 text-xs">{trend}</div>}
    </div>
  )
}

interface SectionHeadingProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function SectionHeading({ title, description, action }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
      <div className="flex items-start gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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
    <div className="rounded-lg bg-muted/40 px-6 py-10 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border/80 bg-white text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-foreground">{title}</p>
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
  return <div className="space-y-3 py-1" aria-hidden="true"><Skeleton className="h-8 w-56 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>
}

export function MetricTileSkeleton() {
  return <div className="space-y-3 border-b py-5" aria-hidden="true"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-24" /><Skeleton className="h-3 w-36" /></div>
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

export function WorkspaceShellSkeleton({ roleLabel, title }: { roleLabel: string; title: string; sidebarLines?: number }) {
  return (
    <div className="min-h-[100dvh] bg-white" role="status" aria-label={title}>
      <span className="sr-only">{roleLabel}: {title}</span>
      <div className="fixed inset-y-0 left-0 hidden w-[232px] border-r bg-[#f8f9fa] p-5 lg:block" aria-hidden="true">
        <Skeleton className="h-7 w-28" />
        <div className="mt-10 space-y-4">{Array.from({length: 6}, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
      </div>
      <div className="lg:pl-[232px]">
        <div className="flex h-16 items-center border-b px-8"><Skeleton className="h-4 w-40" /></div>
        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8"><WorkspaceRouteSkeleton /></div>
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
