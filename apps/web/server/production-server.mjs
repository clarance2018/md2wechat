import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import iconv from 'iconv-lite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const port = Number(process.env.PORT || 80)
const host = process.env.HOST || '0.0.0.0'

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function hasReplacementCharacter(value) {
  return value.includes('\uFFFD')
}

export function decodeLocalFolderText(buffer) {
  const utf8 = iconv.decode(buffer, 'utf8')
  if (!hasReplacementCharacter(utf8)) {
    return { content: utf8, encoding: 'utf8' }
  }

  return {
    content: iconv.decode(buffer, 'gb18030'),
    encoding: 'gb18030',
  }
}

export function encodeLocalFolderText(content, encoding = 'utf8') {
  return iconv.encode(content, encoding === 'gb18030' ? 'gb18030' : 'utf8')
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(data))
}

function sendError(res, message, status = 400) {
  sendJson(res, { error: message }, status)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      }
      catch {
        resolve(null)
      }
    })
    req.on('error', reject)
  })
}

function safePath(basePath, relativePath) {
  const base = path.resolve(basePath)
  const resolved = path.resolve(basePath, relativePath)
  const relative = path.relative(base, resolved)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? resolved : null
}

function loadFolderConfigs() {
  const envValue = process.env.VITE_LOCAL_FOLDERS || ''
  if (!envValue) {
    return []
  }

  return envValue
    .split(',')
    .map((folderPath, index) => {
      const resolved = path.resolve(folderPath.trim())
      let createdAt = new Date().toISOString()
      try {
        createdAt = fs.statSync(resolved).birthtime.toISOString()
      }
      catch {
      }

      return {
        createdAt,
        id: `local_${index}`,
        name: path.basename(resolved),
        path: resolved,
      }
    })
    .filter(folder => fs.existsSync(folder.path))
}

function buildFileTree(dirPath, basePath, sortMode = 'name-asc') {
  const node = {
    children: [],
    name: path.basename(dirPath),
    path: path.relative(basePath, dirPath),
    type: 'directory',
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? -1 : 1
    }

    if (sortMode === 'name-desc') {
      return b.name.localeCompare(a.name, 'zh-CN')
    }

    if (sortMode === 'mtime-asc' || sortMode === 'mtime-desc') {
      const aTime = fs.statSync(path.join(dirPath, a.name)).mtimeMs
      const bTime = fs.statSync(path.join(dirPath, b.name)).mtimeMs
      return sortMode === 'mtime-asc' ? aTime - bTime : bTime - aTime
    }

    return a.name.localeCompare(b.name, 'zh-CN')
  })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.relative(basePath, fullPath)
    if (entry.isDirectory()) {
      node.children.push(buildFileTree(fullPath, basePath, sortMode))
    }
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      node.children.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
      })
    }
  }

  return node
}

export async function handleLocalFolderRequest(req, res) {
  if (!req.url?.startsWith('/api/local-folders')) {
    return false
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    })
    res.end()
    return true
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const folders = loadFolderConfigs()

  if (req.method === 'GET' && pathParts.length === 2) {
    sendJson(res, {
      folders: folders.map(folder => ({
        createdAt: folder.createdAt,
        id: folder.id,
        name: folder.name,
        path: folder.path,
      })),
    })
    return true
  }

  if (pathParts.length !== 4 || pathParts[0] !== 'api' || pathParts[1] !== 'local-folders') {
    sendError(res, 'Not found', 404)
    return true
  }

  const folder = folders.find(item => item.id === pathParts[2])
  if (!folder) {
    sendError(res, `Folder not found: ${pathParts[2]}`, 404)
    return true
  }

  if (req.method === 'GET' && pathParts[3] === 'tree') {
    try {
      sendJson(res, { tree: buildFileTree(folder.path, folder.path, url.searchParams.get('sort') || 'name-asc') })
    }
    catch (error) {
      sendError(res, `Failed to read folder: ${error.message}`, 500)
    }
    return true
  }

  if (req.method === 'GET' && pathParts[3] === 'file') {
    const filePath = url.searchParams.get('path')
    if (!filePath) {
      sendError(res, 'Missing path parameter')
      return true
    }

    const target = safePath(folder.path, filePath)
    if (!target) {
      sendError(res, 'Invalid path: potential path traversal', 403)
      return true
    }

    if (!target.toLowerCase().endsWith('.md')) {
      sendError(res, 'Only .md files are allowed', 403)
      return true
    }

    try {
      const decoded = decodeLocalFolderText(fs.readFileSync(target))
      sendJson(res, { content: decoded.content, encoding: decoded.encoding, path: filePath })
    }
    catch (error) {
      sendError(res, `Failed to read file: ${error.message}`, 500)
    }
    return true
  }

  if (req.method === 'PUT' && pathParts[3] === 'file') {
    const body = await parseBody(req)
    if (!body?.path || body.content === undefined) {
      sendError(res, 'Missing path or content in request body')
      return true
    }

    const target = safePath(folder.path, body.path)
    if (!target) {
      sendError(res, 'Invalid path: potential path traversal', 403)
      return true
    }

    if (!target.toLowerCase().endsWith('.md')) {
      sendError(res, 'Only .md files are allowed', 403)
      return true
    }

    try {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, encodeLocalFolderText(body.content, body.encoding))
      sendJson(res, { encoding: body.encoding || 'utf8', path: body.path, success: true })
    }
    catch (error) {
      sendError(res, `Failed to write file: ${error.message}`, 500)
    }
    return true
  }

  sendError(res, 'Method not allowed', 405)
  return true
}

function serveStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/' || pathname === '/md') {
    pathname = '/md/'
  }

  if (pathname.startsWith('/md/')) {
    pathname = pathname.slice('/md'.length)
  }

  const requested = pathname === '/' ? '/index.html' : pathname
  const target = safePath(distDir, requested)
  const filePath = target && fs.existsSync(target) && fs.statSync(target).isFile()
    ? target
    : path.join(distDir, 'index.html')

  const ext = path.extname(filePath)
  res.writeHead(200, {
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
  })
  fs.createReadStream(filePath).pipe(res)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  http.createServer(async (req, res) => {
    try {
      if (await handleLocalFolderRequest(req, res)) {
        return
      }
      serveStatic(req, res)
    }
    catch (error) {
      console.error(error)
      sendError(res, 'Internal server error', 500)
    }
  }).listen(port, host, () => {
    console.log(`[server] Listening on http://${host}:${port}`)
    console.log(`[server] Serving static files from ${distDir}`)
    console.log(`[server] Bound folders:`, loadFolderConfigs().map(folder => `${folder.name} (${folder.path})`))
  })
}
