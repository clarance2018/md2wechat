import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canUseAsyncClipboard, copyPlain, readPlain } from '../clipboard.ts'

test('allows async clipboard only in secure contexts with the requested method', () => {
  assert.equal(canUseAsyncClipboard({ isSecureContext: true, clipboard: { writeText() {} } }, 'writeText'), true)
  assert.equal(canUseAsyncClipboard({ isSecureContext: false, clipboard: { writeText() {} } }, 'writeText'), false)
  assert.equal(canUseAsyncClipboard({ isSecureContext: true, clipboard: {} }, 'writeText'), false)
})

test('falls back to in-app clipboard when async clipboard reading is unavailable', async () => {
  const originalWindow = globalThis.window
  const originalNavigator = globalThis.navigator
  const originalDocument = globalThis.document
  const originalLocalStorage = globalThis.localStorage
  const values = new Map()

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: false },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      activeElement: null,
      body: {
        appendChild() {},
        removeChild() {},
      },
      createElement: () => ({
        setAttribute() {},
        style: {},
        focus() {},
        select() {},
        setSelectionRange() {},
      }),
      execCommand: () => true,
    },
  })

  try {
    await copyPlain('https://example.com/copied.png')
    assert.equal(await readPlain(), 'https://example.com/copied.png')
  }
  finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage })
  }
})
