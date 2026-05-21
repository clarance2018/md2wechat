import iconv from 'iconv-lite'

export type LocalFolderTextEncoding = 'utf8' | 'gb18030'

export interface DecodedLocalFolderText {
  content: string
  encoding: LocalFolderTextEncoding
}

function hasReplacementCharacter(value: string) {
  return value.includes('\uFFFD')
}

export function decodeLocalFolderText(buffer: Buffer): DecodedLocalFolderText {
  const utf8 = iconv.decode(buffer, 'utf8')
  if (!hasReplacementCharacter(utf8)) {
    return { content: utf8, encoding: 'utf8' }
  }

  return {
    content: iconv.decode(buffer, 'gb18030'),
    encoding: 'gb18030',
  }
}

export function encodeLocalFolderText(content: string, encoding: LocalFolderTextEncoding = 'utf8') {
  return iconv.encode(content, encoding === 'gb18030' ? 'gb18030' : 'utf8')
}
