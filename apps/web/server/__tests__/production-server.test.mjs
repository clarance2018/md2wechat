import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeStaticRequestPath } from '../production-server.mjs'

test('normalizes absolute asset URLs as dist-relative paths', () => {
  assert.equal(normalizeStaticRequestPath('/static/js/app.js'), 'static/js/app.js')
  assert.equal(normalizeStaticRequestPath('/md/static/css/app.css'), 'static/css/app.css')
})
