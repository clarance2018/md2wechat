/**
 * Remote Folder Source Store
 *
 * Manages access to server-side local folders via REST API.
 * Used when multiple devices on the local network need to access the same folders.
 */

import { store } from '@/utils/storage'

export interface RemoteFileSystemNode {
  name: string
  path: string
  type: `file` | `directory`
  children?: RemoteFileSystemNode[]
}

export interface RemoteFolder {
  id: string
  name: string
  path: string
  createdAt: string
}

export type TreeSortMode = 'name-asc' | 'name-desc' | 'mtime-asc' | 'mtime-desc'
export type RemoteFileEncoding = 'utf8' | 'gb18030'

const API_BASE = `/api/local-folders`

export const useRemoteFolderSourceStore = defineStore(`remoteFolderSource`, () => {
  // State
  const folders = ref<RemoteFolder[]>([])
  const currentFolderId = ref<string | null>(null)
  const fileTree = ref<RemoteFileSystemNode[]>([])
  const selectedFilePath = ref<string>(``)
  const isLoading = ref(false)
  const loadError = ref<string>(``)
  const fileEncodings = new Map<string, RemoteFileEncoding>()

  // Tree sort mode (for children within a selected folder), persisted to localStorage
  const treeSortMode = store.reactive<TreeSortMode>(`treeSortMode`, 'name-asc')

  // Current folder info
  const currentFolder = computed(() => {
    if (!currentFolderId.value)
      return null
    return folders.value.find(f => f.id === currentFolderId.value) || null
  })

  /**
   * Load available folders from server
   */
  async function loadFolders() {
    try {
      isLoading.value = true
      loadError.value = ``

      const response = await fetch(API_BASE)
      if (!response.ok) {
        throw new Error(`Failed to load folders: ${response.statusText}`)
      }

      const data = await response.json()
      folders.value = data.folders || []
    }
    catch (error: any) {
      loadError.value = error.message || `Failed to load folders`
      console.error(`[remoteFolderSource] Error loading folders:`, error)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Select and load a folder's file tree
   */
  async function selectFolder(folderId: string) {
    try {
      isLoading.value = true
      loadError.value = ``

      const response = await fetch(`${API_BASE}/${folderId}/tree?sort=${treeSortMode.value}`)
      if (!response.ok) {
        throw new Error(`Failed to load file tree: ${response.statusText}`)
      }

      const data = await response.json()
      currentFolderId.value = folderId
      fileTree.value = data.tree ? [data.tree] : []
    }
    catch (error: any) {
      loadError.value = error.message || `Failed to load file tree`
      console.error(`[remoteFolderSource] Error loading file tree:`, error)
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Close current folder
   */
  function closeFolder() {
    currentFolderId.value = null
    fileTree.value = []
    selectedFilePath.value = ``
  }

  /**
   * Read file content from server
   */
  async function readFile(filePath: string): Promise<string> {
    if (!currentFolderId.value) {
      throw new Error(`No folder selected`)
    }

    try {
      const encodedPath = encodeURIComponent(filePath)
      const response = await fetch(`${API_BASE}/${currentFolderId.value}/file?path=${encodedPath}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to read file`)
      }

      const data = await response.json()
      fileEncodings.set(filePath, data.encoding || 'utf8')
      return data.content
    }
    catch (error: any) {
      toast.error(`读取文件失败: ${error.message}`)
      throw error
    }
  }

  /**
   * Write file content to server
   */
  async function writeFile(filePath: string, content: string): Promise<void> {
    if (!currentFolderId.value) {
      throw new Error(`No folder selected`)
    }

    try {
      const response = await fetch(`${API_BASE}/${currentFolderId.value}/file`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          content,
          encoding: fileEncodings.get(filePath) || 'utf8',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to write file`)
      }
    }
    catch (error: any) {
      console.error(`[remoteFolderSource] Error writing file:`, error)
      throw error
    }
  }

  function getFileEncoding(filePath: string): RemoteFileEncoding {
    return fileEncodings.get(filePath) || 'utf8'
  }

  /**
   * Find node by path in file tree
   */
  function findNodeByPath(nodes: RemoteFileSystemNode[], path: string): RemoteFileSystemNode | null {
    for (const node of nodes) {
      if (node.path === path) {
        return node
      }
      if (node.children) {
        const found = findNodeByPath(node.children, path)
        if (found)
          return found
      }
    }
    return null
  }

  /**
   * Get all markdown files from tree
   */
  function getAllMarkdownFiles(nodes: RemoteFileSystemNode[] = fileTree.value): RemoteFileSystemNode[] {
    const files: RemoteFileSystemNode[] = []
    for (const node of nodes) {
      if (node.type === `file`) {
        files.push(node)
      }
      if (node.children) {
        files.push(...getAllMarkdownFiles(node.children))
      }
    }
    return files
  }

  /**
   * Refresh current folder (re-fetch tree with current sort mode)
   */
  async function refreshFolder() {
    if (currentFolderId.value) {
      await selectFolder(currentFolderId.value)
    }
  }

  /**
   * Set tree sort mode and refresh current folder
   */
  async function setTreeSortMode(mode: TreeSortMode) {
    treeSortMode.value = mode
    if (currentFolderId.value) {
      await selectFolder(currentFolderId.value)
    }
  }

  return {
    // State
    folders,
    currentFolderId,
    fileTree,
    selectedFilePath,
    isLoading,
    loadError,
    treeSortMode,

    // Computed
    currentFolder,

    // Actions
    loadFolders,
    selectFolder,
    closeFolder,
    readFile,
    writeFile,
    getFileEncoding,
    findNodeByPath,
    getAllMarkdownFiles,
    refreshFolder,
    setTreeSortMode,
  }
})
