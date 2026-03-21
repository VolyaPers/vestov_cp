import { Show, SignInButton, UserButton } from '@clerk/react'

export function ClerkAuthBar() {
  return (
    <div className="border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-primary/70">
            Clerk access
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Clerk to sign in. Sign-up stays out of this flow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton />
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </div>
  )
}
