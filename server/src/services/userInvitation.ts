type InternalUser = { email: string; isActive: boolean | null; clerkUserId: string | null; role: string; teamMemberId: number | null }
export type InvitationGateway = {
  getInvitationList(input: { query: string; status: 'pending' }): Promise<{ data: { emailAddress: string; url?: string; id: string }[] }>
  createInvitation(input: { emailAddress: string; notify: false; expiresInDays: number }): Promise<{ id: string; url?: string }>
}

export async function generateInvitationLink(user: InternalUser, gateway: InvitationGateway) {
  if (!user.isActive) throw Object.assign(new Error('Activate the user before generating an invitation'), { status: 409 })
  if (user.clerkUserId) throw Object.assign(new Error('This account is already linked to Clerk. Use the sign-in page or Forgot password.'), { status: 409 })
  if (user.role === 'team_member' && !user.teamMemberId) throw Object.assign(new Error('Link this user to an employee profile in Team before inviting them'), { status: 409 })
  const pending = await gateway.getInvitationList({ query: user.email, status: 'pending' })
  const existing = pending.data.find(invitation => invitation.emailAddress.toLowerCase() === user.email.toLowerCase() && invitation.url)
  const invitation = existing || await gateway.createInvitation({ emailAddress: user.email, notify: false, expiresInDays: 7 })
  if (!invitation.url) throw new Error('Clerk did not return an invitation URL')
  return { invitationId: invitation.id, url: invitation.url, emailSent: false }
}
