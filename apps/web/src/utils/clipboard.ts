export function canUseAsyncClipboard(
  target: { isSecureContext?: boolean, clipboard?: Record<string, unknown> },
  method: `readText` | `write` | `writeText`,
): boolean {
  return target.isSecureContext === true && typeof target.clipboard?.[method] === `function`
}

const IN_APP_CLIPBOARD_KEY = `md_in_app_clipboard_text`
let inAppClipboardText = ``

function rememberInAppClipboard(text: string) {
  inAppClipboardText = text
  try {
    localStorage.setItem(IN_APP_CLIPBOARD_KEY, text)
  }
  catch {
  }
}

function readInAppClipboard(): string {
  if (inAppClipboardText) {
    return inAppClipboardText
  }

  try {
    return localStorage.getItem(IN_APP_CLIPBOARD_KEY) || ``
  }
  catch {
    return ``
  }
}

function legacyCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const activeElement = typeof HTMLElement !== `undefined` && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    try {
      const textarea = document.createElement(`textarea`)
      textarea.value = text
      textarea.setAttribute(`readonly`, `true`)
      textarea.style.position = `fixed`
      textarea.style.top = `0`
      textarea.style.left = `0`
      textarea.style.width = `1px`
      textarea.style.height = `1px`
      textarea.style.opacity = `0`
      textarea.style.pointerEvents = `none`
      document.body.appendChild(textarea)

      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      const ok = document.execCommand(`copy`)
      document.body.removeChild(textarea)
      activeElement?.focus()

      ok ? resolve() : reject(new Error(`execCommand failed`))
    }
    catch (err) {
      activeElement?.focus()
      reject(err)
    }
  })
}

export async function copyPlain(text: string): Promise<void> {
  rememberInAppClipboard(text)

  if (canUseAsyncClipboard({ isSecureContext: window.isSecureContext, clipboard: navigator.clipboard as unknown as Record<string, unknown> }, `writeText`)) {
    try {
      await navigator.clipboard.writeText(text)
      return
    }
    catch {
    }
  }
  await legacyCopy(text)
}

export async function readPlain(): Promise<string> {
  if (!canUseAsyncClipboard({ isSecureContext: window.isSecureContext, clipboard: navigator.clipboard as unknown as Record<string, unknown> }, `readText`)) {
    const text = readInAppClipboard()
    if (text) {
      return text
    }

    throw new Error(`当前页面不支持读取系统剪贴板，请使用浏览器原生粘贴快捷键`)
  }

  return await navigator.clipboard.readText()
}

export async function copyHtml(html: string, fallback?: string): Promise<void> {
  const plain = fallback ?? html.replace(/<[^>]+>/g, ``)
  if (canUseAsyncClipboard({ isSecureContext: window.isSecureContext, clipboard: navigator.clipboard as unknown as Record<string, unknown> }, `write`)) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: `text/html` }),
        'text/plain': new Blob([plain], { type: `text/plain` }),
      })
      await navigator.clipboard.write([item])
      return
    }
    catch {
    }
  }
  await copyPlain(plain)
}
