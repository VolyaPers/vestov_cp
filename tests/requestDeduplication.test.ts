import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createRequestDeduplicator } from '../src/lib/requestDeduplication'

test('concurrent reads share work; later reads fetch fresh data', async () => {
  const request = createRequestDeduplicator()
  let calls = 0
  const execute = async () => ++calls
  const first = request('/salary', 'GET', true, execute)
  const second = request('/salary', 'GET', true, execute)
  assert.equal(first, second)
  assert.deepEqual(await Promise.all([first, second]), [1, 1])
  assert.equal(await request('/salary', 'GET', true, execute), 2)
})

test('writes split the read generation and are never combined', async () => {
  const request = createRequestDeduplicator()
  let release!: (value: number) => void
  const oldRead = request('/salary', 'GET', true, () => new Promise<number>(resolve => { release = resolve }))
  let writes = 0
  await Promise.all([request('/salary', 'POST', false, async () => ++writes), request('/salary', 'POST', false, async () => ++writes)])
  assert.equal(writes, 2)
  assert.equal(await request('/salary', 'GET', true, async () => 42), 42)
  release(1)
  assert.equal(await oldRead, 1)
})

test('failed reads can retry and independently cancellable reads never share work', async () => {
  const request = createRequestDeduplicator()
  await assert.rejects(request('/users', 'GET', true, async () => { throw Error('offline') }))
  assert.equal(await request('/users', 'GET', true, async () => 5), 5)
  let calls = 0
  await Promise.all([request('/users', 'GET', false, async () => ++calls), request('/users', 'GET', false, async () => ++calls)])
  assert.equal(calls, 2)
})
