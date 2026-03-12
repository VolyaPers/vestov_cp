import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const heroThemes = {
  ocean: 'bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(15,23,42,0.06),transparent_22%)]',
  teal: 'bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.16),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(15,23,42,0.06),transparent_22%)]',
  violet: 'bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(15,23,42,0.06),transparent_22%)]',
  amber: 'bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(15,23,42,0.06),transparent_22%)]',
} as const

const metricThemes = {
  primary: 'border border-blue-200/80 bg-blue-50/85 text-blue-700 shadow-[0_18px_30px_-24px_rgba(37,99,235,0.26)]',
  emerald: 'border border-emerald-200/80 bg-emerald-50/85 text-emerald-700 shadow-[0_18px_30px_-24px_rgba(16,185,129,0.22)]',
  amber: 'border border-amber-200/80 bg-amber-50/85 text-amber-700 shadow-[0_18px_30px_-24px_rgba(245,158,11,0.22)]',
  rose: 'border border-rose-200/80 bg-rose-50/85 text-rose-700 shadow-[0_18px_30px_-24px_rgba(244,63,94,0.22)]',
  violet: 'border border-violet-200/80 bg-violet-50/85 text-violet-700 shadow-[0_18px_30px_-24px_rgba(139,92,246,0.22)]',
  slate: 'border border-slate-200/80 bg-slate-100/85 text-slate-700 shadow-[0_18px_30px_-24px_rgba(51,65,85,0.16)]',
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
    <Card className="relative overflow-hidden border-white/70 bg-[rgba(255,255,255,0.8)] text-foreground shadow-[0_34px_80px_-44px_rgba(15,23,42,0.42)]">
      <div className={cn('absolute inset-0 opacity-95', heroThemes[theme])} />
      <CardContent className="relative px-5 pb-5 pt-5 sm:px-8 sm:pb-8 sm:pt-9 lg:px-10 lg:pb-9 lg:pt-10">
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-10">
          <div className="max-w-3xl">
            <Badge variant="outline" className="border-white/85 bg-white/78 text-muted-foreground shadow-[0_14px_28px_-24px_rgba(15,23,42,0.35)]">
              {eyebrow}
            </Badge>
            <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.05] text-foreground sm:mt-4 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-[0.95rem] leading-6 text-muted-foreground sm:mt-4 sm:text-base">
              {description}
            </p>
            {meta && (
              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground sm:mt-6 sm:gap-3.5 sm:text-sm">
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
    <Card className={cn('h-full', className)}>
      <CardContent className="flex h-full flex-col gap-4 px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-7">
        <div className="flex min-h-[2.9rem] items-start justify-between gap-3.5 sm:min-h-[3.25rem] sm:items-center sm:gap-4">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] leading-4 text-muted-foreground sm:text-[0.68rem] sm:leading-5">{label}</p>
          </div>
          {icon && (
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] sm:h-11 sm:w-11 sm:rounded-[1.05rem]', metricThemes[tone])}>
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
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/75 bg-white/72 text-primary shadow-[0_18px_32px_-24px_rgba(15,23,42,0.28)] sm:mt-1 sm:h-11 sm:w-11 sm:rounded-[1.05rem]">
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
    <div className="rounded-[1.35rem] border border-dashed border-border/75 bg-white/58 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] sm:p-8">
      {icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-white/75 bg-white/70 text-muted-foreground shadow-[0_16px_28px_-24px_rgba(15,23,42,0.24)]">
          {icon}
        </div>
      )}
      <p className="font-display text-xl font-semibold text-foreground sm:text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
