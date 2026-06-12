export type LocalFolderAccessReason = 'supported' | 'insecure-context' | 'unsupported-browser'

export interface LocalFolderAccessState {
  isSupported: boolean
  reason: LocalFolderAccessReason
  message: string
  hint: string
}

interface LocalFolderAccessEnvironment {
  isSecureContext?: boolean
  showDirectoryPicker?: unknown
}

export function getLocalFolderAccessState(env: LocalFolderAccessEnvironment): LocalFolderAccessState {
  if (typeof env.showDirectoryPicker === 'function') {
    return {
      hint: '',
      isSupported: true,
      message: '',
      reason: 'supported',
    }
  }

  if (env.isSecureContext === false) {
    return {
      hint: '局域网访问请使用服务器模式，或改用 HTTPS / localhost 后再打开本地模式。',
      isSupported: false,
      message: '当前页面不是安全上下文，浏览器已禁用本地文件夹访问。',
      reason: 'insecure-context',
    }
  }

  return {
    hint: '请使用支持 File System Access API 的 Chrome、Edge 或 Opera 浏览器。',
    isSupported: false,
    message: '当前浏览器不支持本地文件夹访问。',
    reason: 'unsupported-browser',
  }
}

export function getBrowserLocalFolderAccessState(): LocalFolderAccessState {
  if (typeof window === 'undefined') {
    return getLocalFolderAccessState({
      isSecureContext: false,
      showDirectoryPicker: undefined,
    })
  }

  return getLocalFolderAccessState({
    isSecureContext: window.isSecureContext,
    showDirectoryPicker: window.showDirectoryPicker,
  })
}
