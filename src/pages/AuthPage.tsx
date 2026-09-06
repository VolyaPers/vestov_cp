import { Show, SignInButton, UserButton } from '@clerk/react'
import { ArrowRightIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import vestovLogo from '@/assets/vestov-logo.svg'

interface AuthPageProps { errorMessage?: string | null }

export function AuthPage({ errorMessage }: AuthPageProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center gap-2.5 px-6 py-6 sm:px-10">
        <img src={vestovLogo} alt="" className="h-7 w-7 object-contain" />
        <span className="text-base font-semibold tracking-tight">Vestov <span className="font-normal text-muted-foreground">Hub</span></span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[360px]">
          <h1 className="text-[28px] font-semibold tracking-tight">Welcome to Vestov Hub</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Your team, projects and workday in one place.</p>
          {errorMessage && <div role="alert" className="mt-6 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage}</div>}
          <Show when="signed-out">
            <SignInButton>
              <Button className="mt-8 h-11 w-full justify-between px-4">Continue to sign in <ArrowRightIcon className="h-4 w-4" /></Button>
            </SignInButton>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">Use the email address linked to your workspace.</p>
          </Show>
          <Show when="signed-in">
            <div className="mt-8 flex items-center justify-between gap-4 rounded-lg border p-4">
              <p className="text-sm leading-6 text-muted-foreground">Your account is signed in. To use a different email, open your account menu.</p>
              <UserButton />
            </div>
          </Show>
        </div>
      </main>
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">Vestov Hub · Team workspace</footer>
    </div>
  )
}
