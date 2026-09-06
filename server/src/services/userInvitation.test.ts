import test from 'node:test'
import assert from 'node:assert/strict'
import { generateInvitationLink } from './userInvitation.js'

const user = { email: 'fixture@example.invalid', isActive: true, clerkUserId: null, role: 'client', teamMemberId: null }
test('invitation generates a reviewable link without sending email', async () => {
  let input: any
  const response = await generateInvitationLink(user, { getInvitationList: async () => ({ data: [] }), createInvitation: async value => { input = value; return { id: 'inv_1', url: 'https://example.invalid/invite' } } })
  assert.deepEqual(input, { emailAddress: user.email, notify: false, expiresInDays: 7 })
  assert.equal(response.emailSent, false)
  assert.equal(response.url, 'https://example.invalid/invite')
})
test('existing invitation is reused, no external duplicate is created', async () => {
  const response = await generateInvitationLink(user, { getInvitationList: async () => ({ data: [{ emailAddress: user.email, id: 'existing', url: 'https://example.invalid/existing' }] }), createInvitation: async () => { throw Error('must not create') } })
  assert.equal(response.invitationId, 'existing')
})
test('inactive, already linked and employee-without-profile accounts cannot be invited', async () => {
  const gateway = { getInvitationList: async () => { throw Error('must not access provider') }, createInvitation: async () => { throw Error('must not access provider') } }
  await assert.rejects(() => generateInvitationLink({ ...user, isActive: false }, gateway), /Activate/)
  await assert.rejects(() => generateInvitationLink({ ...user, clerkUserId: 'user_1' }, gateway), /already linked/)
  await assert.rejects(() => generateInvitationLink({ ...user, role: 'team_member' }, gateway), /employee profile/)
})
