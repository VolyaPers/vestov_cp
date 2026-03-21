import { Show, SignInButton, UserButton } from '@clerk/react'
import { ArrowRight, ShieldCheck, Sparkles, Users2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthPageProps {
  errorMessage?: string | null
}

const benefitCards = [
  {
    title: 'Operational clarity',
    text: 'Admin, employee and client workspaces now share a more deliberate information hierarchy.',
    icon: ShieldCheck,
  },
  {
    title: 'Faster navigation',
    text: 'Search, dashboards and contextual shortcuts reduce the time spent hunting for routine actions.',
    icon: Sparkles,
  },
  {
    title: 'Role-aware experience',
    text: 'Each workspace still respects the role already assigned to your Vestov Hub account.',
    icon: Users2,
  },
] as const

export function AuthPage({ errorMessage }: AuthPageProps) {
  return (
    <div className="app-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.78)] p-8 text-foreground shadow-[0_40px_90px_-46px_rgba(15,23,42,0.42)] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.06),transparent_24%)]" />
          <div className="absolute right-8 top-8 h-40 w-40 rounded-full border border-white/70 bg-white/30 blur-3xl" />

          <div className="relative">
            <Badge variant="outline" className="border-white/85 bg-white/80 text-muted-foreground shadow-[0_18px_32px_-26px_rgba(15,23,42,0.32)]">
              Vestov Hub
            </Badge>
            <h1 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-tight text-foreground">
              One polished entry point for admin, client and employee workflows.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Clerk now handles sign-in, while Vestov Hub still applies the internal role and workspace access already linked to your email.
            </p>
          </div>

          <div className="relative grid gap-4">
            {benefitCards.map(({ title, text, icon: Icon }) => (
              <div key={title} className="rounded-[1.45rem] border border-white/80 bg-white/72 p-5 shadow-[0_24px_44px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-blue-200/70 bg-blue-50/90 text-blue-700 shadow-[0_18px_30px_-24px_rgba(37,99,235,0.26)]">
                    <Icon className="h-5 w-5" />
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

        <div className="flex items-center justify-center">
          <Card className="w-full max-w-xl">
            <CardHeader className="space-y-4">
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

            <CardContent className="space-y-5">
              {errorMessage ? (
                <div className="rounded-[1.15rem] border border-amber-200/80 bg-amber-50/85 px-4 py-3 text-sm leading-6 text-amber-900">
                  {errorMessage}
                </div>
              ) : null}

              <Show when="signed-out">
                <div className="space-y-4">
                  <div className="rounded-[1.25rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.3)]">
                    <p className="text-sm font-semibold text-foreground">Clerk sign-in</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Use your invited or existing Clerk account. After sign-in, Vestov Hub will match it to your internal role automatically.
                    </p>
                  </div>

                  <SignInButton>
                    <Button className="w-full">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
