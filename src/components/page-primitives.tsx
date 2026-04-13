import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
