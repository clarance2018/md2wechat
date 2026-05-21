/**
 * Folder Configuration Store
 *
 * Manages folder display styles (colors and labels) for visual distinction.
 * Persisted to localStorage via store.reactive().
 */

import { store } from '@/utils/storage'

export interface FolderStyle {
  id: string
  color: string
  label: string
}

export const useFolderConfigStore = defineStore(`folderConfig`, () => {
  // Folder styles, persisted to localStorage
  const folderStyles = store.reactive<FolderStyle[]>(`folderStyles`, [])

  // Predefined color palette
  const colorPalette = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ]

  /**
   * Get folder style by ID
   */
  function getFolderStyle(id: string): FolderStyle | undefined {
    return folderStyles.value.find(s => s.id === id)
  }

  /**
   * Set folder style
   */
  function setFolderStyle(id: string, style: Partial<FolderStyle>) {
    const existing = folderStyles.value.find(s => s.id === id)
    if (existing) {
      Object.assign(existing, style)
    }
    else {
      folderStyles.value.push({
        id,
        color: style.color || colorPalette[folderStyles.value.length % colorPalette.length],
        label: style.label || '',
      })
    }
  }

  /**
   * Remove folder style
   */
  function removeFolderStyle(id: string) {
    const index = folderStyles.value.findIndex(s => s.id === id)
    if (index !== -1) {
      folderStyles.value.splice(index, 1)
    }
  }

  /**
   * Get next available color
   */
  function getNextColor(): string {
    return colorPalette[folderStyles.value.length % colorPalette.length]
  }

  return {
    folderStyles,
    colorPalette,
    getFolderStyle,
    setFolderStyle,
    removeFolderStyle,
    getNextColor,
  }
})
