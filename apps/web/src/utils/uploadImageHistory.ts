export const UPLOADED_IMAGE_HISTORY_KEY = `uploaded_image_history`
export const UPLOADED_IMAGE_HISTORY_TTL_MS = 3 * 24 * 60 * 60 * 1000
export const UPLOADED_IMAGE_HISTORY_MAX_ITEMS = 50

export interface UploadedImageHistoryItem {
  id: string
  url: string
  name: string
  host: string
  uploadedAt: number
}

function isValidHistoryItem(item: Partial<UploadedImageHistoryItem>, now: number): item is UploadedImageHistoryItem {
  const uploadedAt = item.uploadedAt

  return typeof item.id === `string`
    && item.id.length > 0
    && typeof item.url === `string`
    && item.url.length > 0
    && typeof item.name === `string`
    && typeof item.host === `string`
    && typeof uploadedAt === `number`
    && Number.isFinite(uploadedAt)
    && uploadedAt <= now
    && now - uploadedAt <= UPLOADED_IMAGE_HISTORY_TTL_MS
}

export function normalizeUploadedImageHistory(
  records: Partial<UploadedImageHistoryItem>[],
  now = Date.now(),
): UploadedImageHistoryItem[] {
  return records
    .filter(record => isValidHistoryItem(record, now))
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(0, UPLOADED_IMAGE_HISTORY_MAX_ITEMS)
}

export function addUploadedImageHistoryItem(
  records: Partial<UploadedImageHistoryItem>[],
  item: UploadedImageHistoryItem,
  now = Date.now(),
): UploadedImageHistoryItem[] {
  return normalizeUploadedImageHistory([
    item,
    ...records.filter(record => record.url !== item.url),
  ], now)
}

export function deleteUploadedImageHistoryItem(
  records: UploadedImageHistoryItem[],
  id: string,
): UploadedImageHistoryItem[] {
  return records.filter(record => record.id !== id)
}

export function createUploadedImageHistoryItem({
  url,
  name,
  host,
  uploadedAt = Date.now(),
}: {
  url: string
  name: string
  host: string
  uploadedAt?: number
}): UploadedImageHistoryItem {
  return {
    id: `${uploadedAt}-${Math.random().toString(36).slice(2, 10)}`,
    url,
    name,
    host,
    uploadedAt,
  }
}
