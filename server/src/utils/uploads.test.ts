import test from 'node:test'
import assert from 'node:assert/strict'
import { getUploadsDirectory } from './uploads.js'

test('production refuses missing, relative or filesystem-root upload storage', () => {
  for (const directory of [undefined, '', '  ', 'uploads', '/']) {
    assert.throws(() => getUploadsDirectory({ NODE_ENV: 'production', UPLOADS_DIR: directory }, '/app'), /persistent storage mount/)
  }
})

test('configured production storage is independent of the server working directory', () => {
  const config = { NODE_ENV: 'production', UPLOADS_DIR: '/var/data/uploads' }
  assert.equal(getUploadsDirectory(config, '/app'), '/var/data/uploads')
  assert.equal(getUploadsDirectory(config, '/app/server'), '/var/data/uploads')
  assert.equal(getUploadsDirectory({ NODE_ENV: 'development', UPLOADS_DIR: undefined }, '/app'), '/app/uploads')
})
