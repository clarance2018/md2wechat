import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  decodeLocalFolderText,
  encodeLocalFolderText,
} from '../local-folder-encoding.ts'

test('decodes GB18030 markdown without replacement characters and encodes it back', () => {
  const gb18030Bytes = Buffer.from([
    0x23,
    0x20,
    0xd6,
    0xd0,
    0xce,
    0xc4,
    0x0a,
  ])

  const decoded = decodeLocalFolderText(gb18030Bytes)

  assert.equal(decoded.content, '# 中文\n')
  assert.equal(decoded.encoding, 'gb18030')
  assert.equal(decoded.content.includes('\uFFFD'), false)
  assert.deepEqual(encodeLocalFolderText(decoded.content, decoded.encoding), gb18030Bytes)
})

test('keeps UTF-8 markdown as UTF-8', () => {
  const utf8Bytes = Buffer.from('# 中文\n', 'utf8')

  const decoded = decodeLocalFolderText(utf8Bytes)

  assert.equal(decoded.content, '# 中文\n')
  assert.equal(decoded.encoding, 'utf8')
  assert.deepEqual(encodeLocalFolderText(decoded.content, decoded.encoding), utf8Bytes)
})
