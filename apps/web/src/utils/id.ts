export interface IdSource {
  crypto?: {
    randomUUID?: () => string
  }
  now?: () => number
  random?: () => number
}

export function createId(source: IdSource = globalThis): string {
  if (typeof source.crypto?.randomUUID === `function`) {
    return source.crypto.randomUUID()
  }

  const now = source.now ?? Date.now
  const random = source.random ?? Math.random
  return `id-${now().toString(36)}-${random().toString(36).slice(2, 10)}`
}
