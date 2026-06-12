import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('post slider exposes the local content archive view', () => {
  const source = readSource('../post-slider/index.vue')

  assert.match(source, /ContentArchive/)
  assert.match(source, /isArchiveView/)
  assert.match(source, /时间归档/)
})

test('post items expose local folder labels', () => {
  const source = readSource('../post-slider/PostItem.vue')

  assert.match(source, /useFolderConfigStore/)
  assert.match(source, /sourceFolderId/)
  assert.match(source, /getFolderStyle/)
})

test('upload image dialog exposes recent local upload history insertion', () => {
  const source = readSource('../dialogs/UploadImgDialog.vue')

  assert.match(source, /UPLOADED_IMAGE_HISTORY_KEY/)
  assert.match(source, /最近 3 天上传/)
  assert.match(source, /insertImage/)
})
