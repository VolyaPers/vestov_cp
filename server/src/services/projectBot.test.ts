import crypto from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectSlackRequest,
  normalizeClickUpListInput,
  normalizeProjectStatus,
  parseProjectCommand,
  PROJECT_BOT_DEFAULT_TAG,
  requestSimilarity,
  taskStatus,
} from './projectBot.js'
import { verifySlackRequest } from './slackBot.js'

test('maps the project workflow statuses without treating generic closed work as verified', () => {
  assert.equal(normalizeProjectStatus('COMPLETED'), 'COMPLETED')
  assert.equal(normalizeProjectStatus('Live Review'), 'LIVE_REVIEW')
  assert.equal(normalizeProjectStatus('Push Live'), 'PUSH_LIVE')
  assert.equal(normalizeProjectStatus('On Client Clarification'), 'ON_CLIENT_CLARIFICATION')
  assert.equal(normalizeProjectStatus('closed'), 'UNKNOWN')
  assert.equal(taskStatus({ id: '1', name: 'Safe completion', status: { status: 'COMPLETED' } }), 'COMPLETED')
  assert.equal(taskStatus({ id: '2', name: 'Generic close', status: { status: 'Complete' } }), 'LIVE_REVIEW')
})

test('normalizes ClickUp List URLs to the numeric API List ID', () => {
  assert.equal(normalizeClickUpListInput('901523977314'), '901523977314')
  assert.equal(
    normalizeClickUpListInput('https://app.clickup.com/9015956554/v/l/6-901523977314-1'),
    '901523977314',
  )
  assert.equal(
    normalizeClickUpListInput('https://app.clickup.com/9015956554/v/li/901523977314'),
    '901523977314',
  )
  assert.equal(PROJECT_BOT_DEFAULT_TAG, 'cursprint')
})

test('parses slash commands and natural-language member questions', () => {
  assert.deepEqual(parseProjectCommand('sprint'), { kind: 'sprint' })
  assert.deepEqual(parseProjectCommand('needs-me'), { kind: 'needs-me' })
  assert.deepEqual(parseProjectCommand('What is Sergey working on?'), { kind: 'member', memberName: 'sergey' })
  assert.deepEqual(parseProjectCommand('Sergey'), { kind: 'member', memberName: 'sergey' })
  assert.deepEqual(parseProjectCommand('tasks for Eduardo'), { kind: 'member', memberName: 'eduardo' })
})

test('detects actionable Slack requests but ignores project-status questions', () => {
  assert.equal(detectSlackRequest('The checkout button is broken again in production.'), 'bug_report')
  assert.equal(detectSlackRequest('Can we add an export button to the report?'), 'feature_request')
  assert.equal(detectSlackRequest('What is the sprint status today?'), null)
})

test('ranks a related task above an unrelated task', () => {
  const request = 'Checkout button fails when the customer submits a card payment'
  const related = requestSimilarity(request, { name: 'Fix checkout card payment failure', description: 'Submit button errors for customers' })
  const unrelated = requestSimilarity(request, { name: 'Update profile avatar', description: 'Crop team photos' })
  assert.ok(related > unrelated)
  assert.ok(related >= 0.32)
})

test('verifies fresh Slack signatures and rejects tampered bodies', () => {
  const previous = process.env.SLACK_SIGNING_SECRET
  process.env.SLACK_SIGNING_SECRET = 'test-signing-secret'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = Buffer.from('channel_id=C123&text=sprint')
  const signature = `v0=${crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${body.toString('utf8')}`).digest('hex')}`

  assert.equal(verifySlackRequest(body, timestamp, signature), true)
  assert.equal(verifySlackRequest(Buffer.from('tampered'), timestamp, signature), false)
  process.env.SLACK_SIGNING_SECRET = previous
})
