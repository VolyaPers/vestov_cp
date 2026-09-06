import test from 'node:test'
import assert from 'node:assert/strict'
import { feedbackStatus, feedbackMessageBody, nextFeedbackStatus } from './feedbackWorkflow.js'

test('feedback resolution requires a proposal followed by client confirmation; new discussion reopens the work', () => {
  assert.equal(feedbackStatus('reviewed'), 'awaiting_client')
  assert.equal(nextFeedbackStatus('pending', 'client_reply', false), 'pending')
  assert.equal(nextFeedbackStatus('pending', 'manager_reply', false), 'in_progress')
  assert.throws(() => nextFeedbackStatus('in_progress', 'confirm', true), /not been proposed/)
  assert.equal(nextFeedbackStatus('in_progress', 'request_confirmation', true), 'awaiting_client')
  assert.equal(nextFeedbackStatus('awaiting_client', 'client_reply', true), 'in_progress')
  assert.equal(nextFeedbackStatus('awaiting_client', 'confirm', true), 'resolved')
  assert.throws(() => nextFeedbackStatus('resolved', 'manager_reply', true), /must reopen/)
  assert.throws(() => nextFeedbackStatus('resolved', 'confirm', true), /must reopen/)
  assert.equal(nextFeedbackStatus('resolved', 'reopen', true), 'in_progress')
  assert.throws(() => nextFeedbackStatus('pending', 'reopen', false), /Only a resolved/)
})

test('feedback messages reject blank, structured and oversized input without altering historical text', () => {
  assert.equal(feedbackMessageBody('  Text with\na new line.  '), 'Text with\na new line.')
  for (const value of ['', '   ', null, {}, 'x'.repeat(10001)]) assert.throws(() => feedbackMessageBody(value), /1–10000/)
})
