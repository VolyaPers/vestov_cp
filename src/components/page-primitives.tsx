import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const heroThemes = {
  ocean: 'bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_26%),linear-gradient(135deg,rgba(15,23,42,1),rgba(12,74,110,0.92))]',
  teal: 'bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_28%),linear-gradient(135deg,rgba(15,23,42,1),rgba(15,118,110,0.9))]',
  violet: 'bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.26),transparent_34%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,1),rgba(67,56,202,0.9))]',
  amber: 'bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(135deg,rgba(15,23,42,1),rgba(180,83,9,0.88))]',
} as const

const metricThemes = {
  primary: 'bg-primary/10 text-primary shadow-[0_18px_30px_-20px_hsl(var(--primary)/0.9)]',
  emerald: 'bg-emerald-50 text-emerald-600 shadow-[0_18px_30px_-20px_rgba(16,185,129,0.45)]',
  amber: 'bg-amber-50 text-amber-600 shadow-[0_18px_30px_-20px_rgba(245,158,11,0.45)]',
  rose: 'bg-rose-50 text-rose-600 shadow-[0_18px_30px_-20px_rgba(244,63,94,0.42)]',
  violet: 'bg-violet-50 text-violet-600 shadow-[0_18px_30px_-20px_rgba(139,92,246,0.42)]',
  slate: 'bg-slate-100 text-slate-700 shadow-[0_18px_30px_-20px_rgba(51,65,85,0.35)]',
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
    <Card className="relative overflow-hidden border-slate-900/10 bg-slate-950 text-white shadow-[0_32px_70px_-34px_rgba(2,6,23,0.85)]">
      <div className={cn('absolute inset-0', heroThemes[theme])} />
      <CardContent className="relative px-5 pb-5 pt-5 sm:px-8 sm:pb-8 sm:pt-9 lg:px-10 lg:pb-9 lg:pt-10">
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-10">
          <div className="max-w-3xl">
            <Badge className="bg-white/10 text-white hover:bg-white/15">{eyebrow}</Badge>
            <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.05] text-white sm:mt-4 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-[0.95rem] leading-6 text-slate-200 sm:mt-4 sm:text-base">
              {description}
            </p>
            {meta && (
              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-slate-300 sm:mt-6 sm:gap-3.5 sm:text-sm">
                {meta}
              </div>
            )}
          </div>

          {(actions || aside) && (
            <div className="flex w-full flex-col gap-3.5 xl:max-w-sm xl:items-end xl:self-start">
              {actions && <div className="grid w-full grid-cols-1 gap-2.5 sm:flex sm:flex-wrap xl:justify-end">{actions}</div>}
              {aside}
            </div>
          )}
        </div>

        {children && <div className="mt-5 sm:mt-9">{children}</div>}
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
    <Card className={cn('h-full border-white/80 bg-white/82', className)}>
      <CardContent className="flex h-full flex-col gap-4 px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
        <div className="flex min-h-[2.9rem] items-start justify-between gap-3.5 sm:min-h-[3.25rem] sm:items-center sm:gap-4">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] leading-4 text-muted-foreground sm:text-[0.68rem] sm:leading-5">{label}</p>
          </div>
          {icon && (
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] sm:h-11 sm:w-11 sm:rounded-[1rem]', metricThemes[tone])}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-end">
          <p className="font-display text-[1.7rem] font-semibold leading-none text-foreground sm:text-[2rem]">{value}</p>
          {hint && <p className="mt-2.5 text-sm text-muted-foreground sm:mt-3">{hint}</p>}
          {trend && <div className="mt-3 sm:mt-4">{trend}</div>}
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
    <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-primary/10 text-primary sm:mt-1 sm:h-11 sm:w-11 sm:rounded-[1rem]">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h3>
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
    <div className="rounded-[1.3rem] border border-dashed border-border/70 bg-white/50 p-6 text-center sm:p-8">
      {icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] bg-muted/70 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="font-display text-xl font-semibold text-foreground sm:text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
