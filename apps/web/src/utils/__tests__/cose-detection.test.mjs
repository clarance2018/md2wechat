import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isCoseBridgeAvailable,
  shouldRetryCoseDetection,
} from '../coseDetection.ts'

test('detects an available COSE bridge from the window object', () => {
  assert.equal(isCoseBridgeAvailable({ $cose: { getAccounts() {} } }), true)
  assert.equal(isCoseBridgeAvailable({ $cose: { getPlatforms() {} } }), true)
})

test('rejects missing or invalid COSE bridge values', () => {
  assert.equal(isCoseBridgeAvailable({}), false)
  assert.equal(isCoseBridgeAvailable({ $cose: null }), false)
  assert.equal(isCoseBridgeAvailable({ $cose: {} }), false)
})

test('retries detection when publish dialog opens and extension was not found earlier', () => {
  assert.equal(shouldRetryCoseDetection({ dialogOpen: true, extensionInstalled: false }), true)
  assert.equal(shouldRetryCoseDetection({ dialogOpen: false, extensionInstalled: false }), false)
  assert.equal(shouldRetryCoseDetection({ dialogOpen: true, extensionInstalled: true }), false)
})
