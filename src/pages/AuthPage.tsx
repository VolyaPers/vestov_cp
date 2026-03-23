import { Show, SignInButton, UserButton } from '@clerk/react'
import { ArrowRight, CircleCheckBig, ShieldCheck, Sparkles, Users2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthPageProps {
  errorMessage?: string | null
}

const benefitCards = [
  {
    title: 'Operational clarity',
    text: 'Admin, employee and client views now share one hierarchy.',
    icon: ShieldCheck,
  },
  {
    title: 'Faster navigation',
    text: 'Search and shortcuts keep routine actions quick.',
    icon: Sparkles,
  },
  {
    title: 'Role-aware experience',
    text: 'Your assigned role stays intact after sign-in.',
    icon: Users2,
  },
] as const

export function AuthPage({ errorMessage }: AuthPageProps) {
  return (
    <div className="app-shell flex min-h-screen items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:gap-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-white/75 bg-[rgba(255,255,255,0.8)] p-6 shadow-[0_38px_90px_-52px_rgba(15,23,42,0.38)] sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(15,23,42,0.06),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.56))]" />
          <div className="absolute -right-10 top-8 h-36 w-36 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-10 h-44 w-44 rounded-full bg-slate-900/5 blur-3xl" />

          <div className="relative flex h-full flex-col gap-8">
            <div className="max-w-2xl">
              <Badge variant="outline" className="border-white/80 bg-white/80 text-muted-foreground shadow-[0_16px_30px_-24px_rgba(15,23,42,0.24)]">
                Vestov Hub
              </Badge>
              <h1 className="mt-5 max-w-2xl font-display text-[2.55rem] font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl">
                One clean entry point for every workspace role.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Clerk signs you in, then Vestov Hub opens the workspace already tied to your email.
              </p>
            </div>

            <div className="grid gap-4">
              {benefitCards.map(({ title, text, icon: Icon }) => (
                <div key={title} className="rounded-[1.4rem] border border-white/85 bg-white/74 p-5 shadow-[0_22px_42px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-blue-200/70 bg-blue-50/90 text-blue-700 shadow-[0_18px_30px_-24px_rgba(37,99,235,0.26)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        <aside className="flex h-full flex-col">
          <Card className="h-full min-h-[34rem] w-full border-white/85 bg-[rgba(255,255,255,0.84)] shadow-[0_34px_80px_-52px_rgba(15,23,42,0.42)] backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-4">
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/10 text-primary">
                Access Portal
              </Badge>
              <div>
                <CardTitle className="text-3xl">Access your workspace</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6">
                  Sign in with the email address already linked to your Vestov Hub account. Local password registration has been removed from the app.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="flex h-full flex-col space-y-5">
              {errorMessage ? (
                <div className="rounded-[1.15rem] border border-amber-200/80 bg-amber-50/85 px-4 py-3 text-sm leading-6 text-amber-900">
                  {errorMessage}
                </div>
              ) : null}

              <Show when="signed-out">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Clerk sign-in</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Use your invited or existing Clerk account. Vestov Hub will match it to your internal role automatically.
                    </p>
                  </div>

                  <SignInButton>
                    <Button className="h-12 w-full rounded-full border-blue-600 bg-blue-600 text-base text-white shadow-[0_18px_36px_-24px_rgba(37,99,235,0.42)] hover:bg-blue-700 hover:text-white">
                      Continue to sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </SignInButton>
                </div>
              </Show>

              <Show when="signed-in">
                <div className="rounded-[1.25rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.3)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Signed in with Clerk</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Vestov Hub is checking whether this Clerk identity is linked to an active internal workspace account. If this is the wrong account, switch it from the user menu.
                      </p>
                    </div>
                    <UserButton />
                  </div>
                </div>
              </Show>
              <div className="mt-auto border-t border-slate-200/70 pt-5">
                <p className="text-sm font-semibold text-foreground">Access notes</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CircleCheckBig className="mt-0.5 h-4 w-4 text-blue-700" />
                    <p className="text-sm leading-6 text-muted-foreground">Use the email address already added to the internal Vestov Hub users list.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleCheckBig className="mt-0.5 h-4 w-4 text-blue-700" />
                    <p className="text-sm leading-6 text-muted-foreground">If you land on the wrong account, switch users from the Clerk menu and try again.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleCheckBig className="mt-0.5 h-4 w-4 text-blue-700" />
                    <p className="text-sm leading-6 text-muted-foreground">No password signup is needed here. Clerk handles the identity check, then Vestov Hub loads your role.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
