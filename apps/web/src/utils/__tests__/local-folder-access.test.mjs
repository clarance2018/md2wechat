import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getLocalFolderAccessState } from '../localFolderAccess.ts'

test('reports insecure context when File System Access API is hidden on LAN HTTP origins', () => {
  const state = getLocalFolderAccessState({
    isSecureContext: false,
    showDirectoryPicker: undefined,
  })

  assert.equal(state.isSupported, false)
  assert.equal(state.reason, 'insecure-context')
  assert.match(state.message, /安全上下文/)
  assert.match(state.hint, /服务器模式/)
})

test('reports unsupported browser when secure context lacks File System Access API', () => {
  const state = getLocalFolderAccessState({
    isSecureContext: true,
    showDirectoryPicker: undefined,
  })

  assert.equal(state.isSupported, false)
  assert.equal(state.reason, 'unsupported-browser')
})

test('reports supported when the directory picker is available in a secure context', () => {
  const state = getLocalFolderAccessState({
    isSecureContext: true,
    showDirectoryPicker: async () => ({}),
  })

  assert.equal(state.isSupported, true)
  assert.equal(state.reason, 'supported')
})
