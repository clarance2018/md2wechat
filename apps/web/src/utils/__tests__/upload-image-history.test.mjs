import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addUploadedImageHistoryItem,
  createUploadedImageHistoryItemFromUpload,
  deleteUploadedImageHistoryItem,
  normalizeUploadedImageHistory,
  UPLOADED_IMAGE_HISTORY_MAX_ITEMS,
} from '../uploadImageHistory.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 4, 26, 8, 0, 0)

test('keeps only recent valid records sorted newest first', () => {
  const records = normalizeUploadedImageHistory([
    { id: 'old', url: 'https://example.com/old.png', name: 'old.png', host: 'GitHub', uploadedAt: NOW - 4 * DAY },
    { id: 'newer', url: 'https://example.com/newer.png', name: 'newer.png', host: 'GitHub', uploadedAt: NOW - 1000 },
    { id: 'new', url: 'https://example.com/new.png', name: 'new.png', host: '默认', uploadedAt: NOW - 2000 },
    { id: 'bad-url', url: '', name: 'bad.png', host: '默认', uploadedAt: NOW },
    { id: 'bad-time', url: 'https://example.com/bad.png', name: 'bad.png', host: '默认', uploadedAt: Number.NaN },
  ], NOW)

  assert.deepEqual(records.map(record => record.id), ['newer', 'new'])
})

test('adds new record, replaces duplicate url, and caps stored records', () => {
  const existing = Array.from({ length: UPLOADED_IMAGE_HISTORY_MAX_ITEMS + 3 }, (_, index) => ({
    id: `item-${index}`,
    url: `https://example.com/${index}.png`,
    name: `${index}.png`,
    host: '默认',
    uploadedAt: NOW - index,
  }))

  const records = addUploadedImageHistoryItem(existing, {
    id: 'latest',
    url: 'https://example.com/10.png',
    name: 'latest.png',
    host: 'GitHub',
    uploadedAt: NOW + 1000,
  }, NOW + 1000)

  assert.equal(records.length, UPLOADED_IMAGE_HISTORY_MAX_ITEMS)
  assert.equal(records[0].id, 'latest')
  assert.equal(records.filter(record => record.url === 'https://example.com/10.png').length, 1)
})

test('deletes matching record id only', () => {
  const records = deleteUploadedImageHistoryItem([
    { id: 'a', url: 'https://example.com/a.png', name: 'a.png', host: '默认', uploadedAt: NOW },
    { id: 'b', url: 'https://example.com/b.png', name: 'b.png', host: '默认', uploadedAt: NOW },
  ], 'a')

  assert.deepEqual(records.map(record => record.id), ['b'])
})

test('creates a history item for pasted uploads with a displayable url and fallback name', () => {
  const item = createUploadedImageHistoryItemFromUpload({
    url: 'https://example.com/pasted.png',
    fileName: '',
    host: 'GitHub',
    uploadedAt: NOW,
  })

  assert.equal(item.url, 'https://example.com/pasted.png')
  assert.equal(item.name, 'image')
  assert.equal(item.host, 'GitHub')
  assert.equal(item.uploadedAt, NOW)
})

test('does not create a history item without an uploaded url', () => {
  const item = createUploadedImageHistoryItemFromUpload({
    url: '',
    fileName: 'pasted.png',
    host: 'GitHub',
    uploadedAt: NOW,
  })

  assert.equal(item, null)
})
