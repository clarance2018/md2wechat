import { useFolderSourceStore } from '@/stores/folderSource'
import { usePostStore } from '@/stores/post'

/**
 * 文件夹文件保存 Composable
 * 编辑器内容仅保存在浏览器状态中，只有显式保存才写回源文件。
 */
export function useFolderFileSync() {
  const postStore = usePostStore()
  const folderStore = useFolderSourceStore()

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
      await folderStore.writeFile(currentFilePath.value, content)
      lastSavedContent.value = content
      isDirty.value = false
      return true
    }
    catch (error: any) {
      console.error('文件保存失败:', error)
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
