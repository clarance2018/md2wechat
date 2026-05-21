/**
 * Vite Plugin: Local Folder Access
 *
 * Provides REST API endpoints for accessing server-side local folders.
 * Only active in development mode (apply: 'serve').
 *
 * API Endpoints:
 *   GET  /api/local-folders           - List bound folders
 *   GET  /api/local-folders/:id/tree  - Get file tree
 *   GET  /api/local-folders/:id/file  - Read file content
 *   PUT  /api/local-folders/:id/file  - Write file content
 */

import type { Plugin, ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { decodeLocalFolderText, encodeLocalFolderText } from './local-folder-encoding'

interface FolderConfig {
  id: string
  name: string
  path: string
  createdAt: string
}

interface FileSystemNode {
  name: string
  path: string
  type: `file` | `directory`
  children?: FileSystemNode[]
}

/**
 * Resolve and validate that target path is within allowed directory
 */
function safePath(basePath: string, relativePath: string): string | null {
  const resolved = path.resolve(basePath, relativePath)
  // Ensure the resolved path starts with the base path (prevent path traversal)
  if (!resolved.startsWith(path.resolve(basePath))) {
    return null
  }
  return resolved
}

type TreeSortMode = 'name-asc' | 'name-desc' | 'mtime-asc' | 'mtime-desc'

/**
 * Build file tree recursively, only including .md files
 */
function buildFileTree(dirPath: string, basePath: string, sortMode: TreeSortMode = 'name-asc'): FileSystemNode {
  const name = path.basename(dirPath)
  const node: FileSystemNode = {
    name,
    path: path.relative(basePath, dirPath),
    type: `directory`,
    children: [],
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    // Sort: directories first, then files, by specified mode
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1
      }

      switch (sortMode) {
        case 'name-desc':
          return b.name.localeCompare(a.name, `zh-CN`)
        case 'mtime-asc': {
          const aTime = fs.statSync(path.join(dirPath, a.name)).mtimeMs
          const bTime = fs.statSync(path.join(dirPath, b.name)).mtimeMs
          return aTime - bTime
        }
        case 'mtime-desc': {
          const aTime = fs.statSync(path.join(dirPath, a.name)).mtimeMs
          const bTime = fs.statSync(path.join(dirPath, b.name)).mtimeMs
          return bTime - aTime
        }
        case 'name-asc':
        default:
          return a.name.localeCompare(b.name, `zh-CN`)
      }
    })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(basePath, fullPath)

      if (entry.isDirectory()) {
        const childNode = buildFileTree(fullPath, basePath, sortMode)
        node.children!.push(childNode)
      }
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(`.md`)) {
        node.children!.push({
          name: entry.name,
          path: relativePath,
          type: `file`,
        })
      }
    }
  }
  catch (error) {
    console.error(`[local-folder] Error reading directory: ${dirPath}`, error)
  }

  return node
}

/**
 * Parse request body as JSON
 */
function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ``
    req.on(`data`, (chunk: any) => {
      body += chunk.toString()
    })
    req.on(`end`, () => {
      try {
        resolve(JSON.parse(body))
      }
      catch {
        resolve(null)
      }
    })
    req.on(`error`, reject)
  })
}

/**
 * Send JSON response
 */
function sendJson(res: any, data: any, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

/**
 * Send error response
 */
function sendError(res: any, message: string, status = 400) {
  sendJson(res, { error: message }, status)
}

/**
 * Load folder configurations from environment variable
 */
function loadFolderConfigs(): FolderConfig[] {
  // Try to read from .env.development file directly
  const envPath = path.resolve(process.cwd(), '.env.development')
  let envValue = process.env.VITE_LOCAL_FOLDERS || ''

  if (!envValue && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const match = envContent.match(/^VITE_LOCAL_FOLDERS=(.+)$/m)
    if (match) {
      envValue = match[1].trim()
    }
  }

  if (!envValue) {
    return []
  }

  return envValue.split(`,`).map((folderPath, index) => {
    const trimmed = folderPath.trim()
    const resolved = path.resolve(trimmed)
    const name = path.basename(resolved)

    // Get directory creation time
    let createdAt = new Date().toISOString()
    try {
      const stats = fs.statSync(resolved)
      createdAt = stats.birthtime.toISOString()
    }
    catch {
      // Use current time as fallback
    }

    return {
      id: `local_${index}`,
      name,
      path: resolved,
      createdAt,
    }
  }).filter(f => fs.existsSync(f.path))
}

/**
 * Get folders with lazy loading (reads env on first request)
 */
function getFolders(): FolderConfig[] {
  // Reload on each request to pick up env changes
  return loadFolderConfigs()
}

export function localFolderPlugin(): Plugin {
  return {
    name: `vite-plugin-local-folder`,
    apply: `serve`, // Only in dev mode

    configureServer(server: ViteDevServer) {
      // Load folder configs on startup
      let folders = loadFolderConfigs()

      console.log(`[local-folder] Initial folders:`, folders)

      // Watch for env changes (hot reload)
      server.ws.on(`local-folder:reload`, () => {
        folders = loadFolderConfigs()
        console.log(`[local-folder] Reloaded folder configs:`, folders.map(f => f.name))
      })

      // Add middleware before Vite's internal handlers
      server.middlewares.use(async (req, res, next) => {
        // Only handle /api/local-folders requests
        if (!req.url?.startsWith(`/api/local-folders`)) {
          return next()
        }

        // Handle CORS preflight
        if (req.method === `OPTIONS`) {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }

        const url = new URL(req.url, `http://${req.headers.host}`)
        const pathParts = url.pathname.split(`/`).filter(Boolean)

        // GET /api/local-folders - List folders
        if (req.method === `GET` && pathParts.length === 2 && pathParts[0] === `api` && pathParts[1] === `local-folders`) {
          const folderList = folders.map(f => ({
            id: f.id,
            name: f.name,
            path: f.path,
            createdAt: f.createdAt,
          }))
          sendJson(res, { folders: folderList })
          return
        }

        // GET /api/local-folders/:id/tree - Get file tree
        if (req.method === `GET` && pathParts.length === 4 && pathParts[0] === `api` && pathParts[1] === `local-folders` && pathParts[3] === `tree`) {
          const folderId = pathParts[2]
          const folder = folders.find(f => f.id === folderId)

          if (!folder) {
            sendError(res, `Folder not found: ${folderId}`, 404)
            return
          }

          if (!fs.existsSync(folder.path)) {
            sendError(res, `Folder path does not exist: ${folder.path}`, 404)
            return
          }

          const sortMode = (url.searchParams.get('sort') as TreeSortMode) || 'name-asc'
          const tree = buildFileTree(folder.path, folder.path, sortMode)
          sendJson(res, { tree })
          return
        }

        // GET /api/local-folders/:id/file?path=xxx - Read file
        if (req.method === `GET` && pathParts.length === 4 && pathParts[0] === `api` && pathParts[1] === `local-folders` && pathParts[3] === `file`) {
          const folderId = pathParts[2]
          const filePath = url.searchParams.get(`path`)

          if (!filePath) {
            sendError(res, `Missing path parameter`)
            return
          }

          const folder = folders.find(f => f.id === folderId)
          if (!folder) {
            sendError(res, `Folder not found: ${folderId}`, 404)
            return
          }

          const safeFilePath = safePath(folder.path, filePath)
          if (!safeFilePath) {
            sendError(res, `Invalid path: potential path traversal`, 403)
            return
          }

          if (!fs.existsSync(safeFilePath)) {
            sendError(res, `File not found: ${filePath}`, 404)
            return
          }

          // Security: only allow .md files
          if (!safeFilePath.toLowerCase().endsWith(`.md`)) {
            sendError(res, `Only .md files are allowed`, 403)
            return
          }

          try {
            const decoded = decodeLocalFolderText(fs.readFileSync(safeFilePath))
            sendJson(res, { content: decoded.content, encoding: decoded.encoding, path: filePath })
          }
          catch (error: any) {
            sendError(res, `Failed to read file: ${error.message}`, 500)
          }
          return
        }

        // PUT /api/local-folders/:id/file - Write file
        if (req.method === `PUT` && pathParts.length === 4 && pathParts[0] === `api` && pathParts[1] === `local-folders` && pathParts[3] === `file`) {
          const folderId = pathParts[2]
          const body = await parseBody(req)

          if (!body?.path || body.content === undefined) {
            sendError(res, `Missing path or content in request body`)
            return
          }

          const folder = folders.find(f => f.id === folderId)
          if (!folder) {
            sendError(res, `Folder not found: ${folderId}`, 404)
            return
          }

          const safeFilePath = safePath(folder.path, body.path)
          if (!safeFilePath) {
            sendError(res, `Invalid path: potential path traversal`, 403)
            return
          }

          // Security: only allow .md files
          if (!safeFilePath.toLowerCase().endsWith(`.md`)) {
            sendError(res, `Only .md files are allowed`, 403)
            return
          }

          try {
            // Ensure directory exists
            const dir = path.dirname(safeFilePath)
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true })
            }

            fs.writeFileSync(safeFilePath, encodeLocalFolderText(body.content, body.encoding))
            sendJson(res, { success: true, encoding: body.encoding || 'utf8', path: body.path })
          }
          catch (error: any) {
            sendError(res, `Failed to write file: ${error.message}`, 500)
          }
          return
        }

        // Method not allowed
        sendError(res, `Method not allowed`, 405)
      })

      console.log(`[local-folder] Plugin loaded. Bound folders:`, folders.map(f => `${f.name} (${f.path})`))
    },
  }
}
