import test from 'node:test'
import assert from 'node:assert/strict'
import { assignedProgressTasks, isInProgress } from './clientTeamActivity.js'

test('only In Progress is treated as current work, not generic active or review states', () => {
  for (const status of ['In Progress', ' IN_PROGRESS ', 'in-progress']) assert.equal(isInProgress({ id: '1', name: 'Task', status: { status } }), true)
  for (const status of ['Open', 'To Do', 'Live Review', 'Completed', 'Paused']) assert.equal(isInProgress({ id: '1', name: 'Task', status: { status, type: 'custom' } }), false)
})
test('matches stable assignee IDs, supports multiple assignees and deduplicates tasks', () => {
  const task = { id: 'task1', name: 'Current work', status: 'in progress', assignees: [{ id: 123 }, { id: '456' }] }
  assert.equal(assignedProgressTasks([task, task], '123').length, 1)
  assert.equal(assignedProgressTasks([task], '456').length, 1)
  assert.deepEqual(assignedProgressTasks([task], '789'), [])
  assert.deepEqual(assignedProgressTasks([{ ...task, status: 'complete' }], '123'), [])
})
