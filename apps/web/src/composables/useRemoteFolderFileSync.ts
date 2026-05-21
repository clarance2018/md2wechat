import { usePostStore } from '@/stores/post'
import { useRemoteFolderSourceStore } from '@/stores/remoteFolderSource'

/**
 * Remote folder file save composable.
 * Editor changes stay in browser state until the user explicitly saves.
 */
export function useRemoteFolderFileSync() {
  const postStore = usePostStore()
  const remoteFolderStore = useRemoteFolderSourceStore()

  const currentFilePath = ref<string | null>(null)
  const lastSavedContent = ref(``)
  const isDirty = ref(false)
  const isSaving = ref(false)

  function setCurrentFilePath(filePath: string | null, savedContent = postStore.currentPost?.content || ``) {
    currentFilePath.value = filePath
    lastSavedContent.value = filePath ? savedContent : ``
    isDirty.value = false
  }

  async function saveCurrentFile() {
    if (!currentFilePath.value || !postStore.currentPost) {
      return false
    }

    const content = postStore.currentPost.content || ``
    try {
      isSaving.value = true
      await remoteFolderStore.writeFile(currentFilePath.value, content)
      lastSavedContent.value = content
      isDirty.value = false
      return true
    }
    catch (error: any) {
      console.error(`[remoteFileSync] Save failed:`, error)
      throw error
    }
    finally {
      isSaving.value = false
    }
  }

  watch(
    () => postStore.currentPost?.content,
    (content) => {
      if (!currentFilePath.value) {
        isDirty.value = false
        return
      }
      isDirty.value = (content || ``) !== lastSavedContent.value
    },
    { deep: false },
  )

  return {
    currentFilePath,
    isDirty,
    isSaving,
    setCurrentFilePath,
    saveCurrentFile,
  }
}
