import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createId } from '../id.ts'

test('uses crypto.randomUUID when available', () => {
  const id = createId({
    crypto: {
      randomUUID: () => 'uuid-from-crypto',
    },
  })

  assert.equal(id, 'uuid-from-crypto')
})

test('falls back when crypto.randomUUID is unavailable', () => {
  const id = createId({
    crypto: {},
    now: () => 123456789,
    random: () => 0.5,
  })

  assert.match(id, /^id-21i3v9-i$/)
})
