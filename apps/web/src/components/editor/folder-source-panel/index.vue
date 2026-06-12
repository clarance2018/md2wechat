<script setup lang="ts">
import {
  ArrowUpDown,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  FolderTree as FolderTreeIcon,
  Globe,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  Server,
  Settings,
  X,
} from '@lucide/vue'
import { useFolderFileSync } from '@/composables/useFolderFileSync'
import { useRemoteFolderFileSync } from '@/composables/useRemoteFolderFileSync'
import { useFolderConfigStore } from '@/stores/folderConfig'
import { useFolderSourceStore } from '@/stores/folderSource'
import { usePostStore } from '@/stores/post'
import { useRemoteFolderSourceStore } from '@/stores/remoteFolderSource'
import { useUIStore } from '@/stores/ui'
import FolderTree from './FolderTree.vue'

const folderSourceStore = useFolderSourceStore()
const remoteFolderStore = useRemoteFolderSourceStore()
const folderConfigStore = useFolderConfigStore()
const postStore = usePostStore()
const uiStore = useUIStore()
const localFileSync = useFolderFileSync()
const remoteFileSync = useRemoteFolderFileSync()
const { setCurrentFilePath: setLocalFilePath } = localFileSync
const { setCurrentFilePath: setRemoteFilePath } = remoteFileSync

const { isMobile, isOpenFolderPanel } = storeToRefs(uiStore)

// Mode: 'local' or 'server'
const mode = ref<'local' | 'server'>('server')

// 控制是否启用动画
const enableAnimation = ref(false)

watch(isOpenFolderPanel, () => {
  if (isMobile.value) {
    enableAnimation.value = true
  }
})

watch(isMobile, () => {
  enableAnimation.value = false
})

// Local folder store refs
const {
  currentFolderHandle,
  fileTree: localFileTree,
  selectedFilePath: localSelectedFilePath,
  isLoading: localIsLoading,
  loadError: localLoadError,
  fileSystemAccessState,
  isFileSystemAPISupported,
} = storeToRefs(folderSourceStore)

// Remote folder store refs
const {
  folders: remoteFolders,
  currentFolder: remoteCurrentFolder,
  fileTree: remoteFileTree,
  selectedFilePath: remoteSelectedFilePath,
  isLoading: remoteIsLoading,
  loadError: remoteLoadError,
  treeSortMode,
} = storeToRefs(remoteFolderStore)

// Folder styles map for FolderTree
const folderStylesMap = computed(() => {
  const map = new Map()
  remoteFolders.value.forEach((folder) => {
    const style = folderConfigStore.getFolderStyle(folder.id)
    if (style) {
      map.set(folder.path, style)
    }
  })
  return map
})

// Computed properties for current mode
const isLoading = computed(() => mode.value === 'local' ? localIsLoading.value : remoteIsLoading.value)
const activeFileSync = computed(() => mode.value === 'local' ? localFileSync : remoteFileSync)
const hasOpenFile = computed(() => Boolean(activeFileSync.value.currentFilePath.value))
const isCurrentFileDirty = computed(() => activeFileSync.value.isDirty.value)
const isCurrentFileSaving = computed(() => activeFileSync.value.isSaving.value)

const expandedPaths = ref<Set<string>>(new Set())

// Load remote folders on mount
onMounted(() => {
  remoteFolderStore.loadFolders()
})

function handleToggleExpand(path: string) {
  if (expandedPaths.value.has(path)) {
    expandedPaths.value.delete(path)
  }
  else {
    expandedPaths.value.add(path)
  }
  // 触发响应式更新
  expandedPaths.value = new Set(expandedPaths.value)
}

// Local folder handlers
async function handleSelectLocalFolder() {
  await folderSourceStore.selectFolder()
  // 等待下一个 tick，确保 fileTree 已经更新
  await nextTick()
  // 展开根节点
  if (localFileTree.value.length > 0) {
    expandedPaths.value.add(localFileTree.value[0].path)
  }
}

async function handleRefreshLocalFolder() {
  if (currentFolderHandle.value) {
    await folderSourceStore.loadFileTree(currentFolderHandle.value.handle)
  }
}

function handleCloseLocalFolder() {
  folderSourceStore.closeFolder()
  expandedPaths.value.clear()
  setLocalFilePath(null)
}

// Remote folder handlers
async function handleSelectRemoteFolder(folderId: string) {
  await remoteFolderStore.selectFolder(folderId)
  await nextTick()
  if (remoteFileTree.value.length > 0) {
    expandedPaths.value.add(remoteFileTree.value[0].path)
  }
}

async function handleRefreshRemoteFolder() {
  await remoteFolderStore.refreshFolder()
}

function handleCloseRemoteFolder() {
  remoteFolderStore.closeFolder()
  expandedPaths.value.clear()
  setRemoteFilePath(null)
}

// Tree sort mode handler
function handleTreeSortModeChange() {
  const modes = ['name-asc', 'name-desc', 'mtime-asc', 'mtime-desc'] as const
  const currentIndex = modes.indexOf(treeSortMode.value)
  const nextIndex = (currentIndex + 1) % modes.length
  remoteFolderStore.setTreeSortMode(modes[nextIndex])
}

// Get tree sort mode label
const treeSortModeLabel = computed(() => {
  switch (treeSortMode.value) {
    case 'name-asc': return '名称↑'
    case 'name-desc': return '名称↓'
    case 'mtime-asc': return '时间↑'
    case 'mtime-desc': return '时间↓'
    default: return '排序'
  }
})

// Folder style dialog
const showStyleDialog = ref(false)
const editingFolderId = ref<string>('')
const editingColor = ref('')
const editingLabel = ref('')

function openStyleDialog(folderId: string) {
  editingFolderId.value = folderId
  const existing = folderConfigStore.getFolderStyle(folderId)
  editingColor.value = existing?.color || folderConfigStore.getNextColor()
  editingLabel.value = existing?.label || ''
  showStyleDialog.value = true
}

function saveStyle() {
  folderConfigStore.setFolderStyle(editingFolderId.value, {
    color: editingColor.value,
    label: editingLabel.value,
  })
  showStyleDialog.value = false
}

// Common handlers
async function handleOpenFile(node: any) {
  try {
    let content: string

    if (mode.value === 'local') {
      content = await folderSourceStore.readFile(node.path)
    }
    else {
      content = await remoteFolderStore.readFile(node.path)
    }

    // 从文件名中提取标题（移除 .md 扩展名）
    const title = node.name.replace(/\.md$/i, '')

    // 检查是否已存在相同来源的文章，避免重复创建
    const folderId = mode.value === 'local' ? null : remoteFolderStore.currentFolderId
    const existingPost = postStore.posts.find(
      p => p.sourceFolderId === (folderId || undefined) && p.title === title,
    )

    if (existingPost) {
      // 已存在则切换到该文章并更新内容
      postStore.currentPostId = existingPost.id
      postStore.updatePostContent(existingPost.id, content)
    }
    else {
      // 不存在则创建新文章
      postStore.addPost(title, null, folderId || undefined)
      postStore.updatePostContent(postStore.currentPostId, content)
    }

    if (mode.value === 'local') {
      setLocalFilePath(node.path, content)
      setRemoteFilePath(null)
    }
    else {
      setRemoteFilePath(node.path, content)
      setLocalFilePath(null)
    }

    toast.success(`已加载文件: ${node.name}`)
  }
  catch (error) {
    console.error('打开文件失败:', error)
  }
}

function handleCloseFolder() {
  if (mode.value === 'local') {
    handleCloseLocalFolder()
  }
  else {
    handleCloseRemoteFolder()
  }
}

function handleRefreshFolder() {
  if (mode.value === 'local') {
    handleRefreshLocalFolder()
  }
  else {
    handleRefreshRemoteFolder()
  }
}

async function handleSaveFile() {
  try {
    const saved = await activeFileSync.value.saveCurrentFile()
    if (saved) {
      toast.success('文件已保存')
    }
  }
  catch (error: any) {
    toast.error(`保存文件失败: ${error.message || error}`)
  }
}
</script>

<template>
  <!-- 移动端遮罩层 -->
  <Transition name="fade">
    <div
      v-if="isMobile && isOpenFolderPanel"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
      @click="isOpenFolderPanel = false"
    />
  </Transition>

  <div
    class="folder-source-panel h-full flex flex-col"
    :class="{
      'fixed top-0 left-0 z-55 w-full bg-background border-r border-border shadow-xl': isMobile,
      'animate-slider': isMobile && enableAnimation,
    }"
    :style="isMobile ? { transform: isOpenFolderPanel ? 'translateX(0)' : 'translateX(-100%)' } : undefined"
  >
    <!-- 头部工具栏 -->
    <div class="panel-header sticky top-0 z-10 bg-background border-b p-2">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold flex items-center gap-2">
          <FolderTreeIcon class="h-4 w-4" />
          文件管理
        </h3>
        <div class="flex items-center gap-1">
          <Button
            v-if="mode === 'local' ? currentFolderHandle : remoteCurrentFolder"
            variant="ghost"
            size="sm"
            class="h-7 w-7 p-0"
            title="关闭文件夹"
            @click="handleCloseFolder"
          >
            <FolderClosed class="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 w-7 p-0"
            title="关闭面板"
            @click="isOpenFolderPanel = false"
          >
            <X class="h-3 w-3" />
          </Button>
        </div>
      </div>

      <!-- 模式切换 Tab -->
      <div class="flex gap-1 mb-2 bg-muted rounded-md p-1">
        <button
          class="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded transition-colors"
          :class="mode === 'server' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="mode = 'server'"
        >
          <Server class="h-3 w-3" />
          服务器
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 px-2 rounded transition-colors"
          :class="mode === 'local' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="mode = 'local'"
        >
          <HardDrive class="h-3 w-3" />
          本地
        </button>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-1">
        <!-- 本地模式按钮 -->
        <template v-if="mode === 'local'">
          <Button
            variant="outline"
            size="sm"
            class="flex-1 text-xs"
            :disabled="localIsLoading || !isFileSystemAPISupported"
            @click="handleSelectLocalFolder"
          >
            <FolderPlus v-if="!localIsLoading" class="h-3 w-3 mr-1" />
            <Loader2 v-else class="h-3 w-3 mr-1 animate-spin" />
            打开文件夹
          </Button>
        </template>

        <!-- 服务器模式按钮 -->
        <template v-else-if="mode === 'server'">
          <Button
            variant="outline"
            size="sm"
            class="flex-1 text-xs"
            :disabled="remoteIsLoading"
            @click="remoteFolderStore.loadFolders()"
          >
            <RefreshCw v-if="!remoteIsLoading" class="h-3 w-3 mr-1" />
            <Loader2 v-else class="h-3 w-3 mr-1 animate-spin" />
            刷新列表
          </Button>
        </template>

        <Button
          v-if="hasOpenFile"
          variant="outline"
          size="sm"
          class="text-xs min-w-16"
          :disabled="!isCurrentFileDirty || isCurrentFileSaving"
          :title="isCurrentFileDirty ? '保存到源文件' : '没有未保存修改'"
          @click="handleSaveFile"
        >
          <Save v-if="!isCurrentFileSaving" class="h-3 w-3 mr-1" />
          <Loader2 v-else class="h-3 w-3 mr-1 animate-spin" />
          {{ isCurrentFileDirty ? '未保存' : '保存' }}
        </Button>

        <Button
          v-if="mode === 'local' ? currentFolderHandle : remoteCurrentFolder"
          variant="outline"
          size="sm"
          class="text-xs"
          :disabled="isLoading"
          @click="handleRefreshFolder"
        >
          <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': isLoading }" />
        </Button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="panel-content flex-1 overflow-y-auto p-2">
      <!-- 本地模式内容 -->
      <template v-if="mode === 'local'">
        <!-- 不支持 API 的提示 -->
        <div
          v-if="!isFileSystemAPISupported"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground"
        >
          <FolderClosed class="h-12 w-12 mb-2 opacity-50" />
          <p class="text-sm">
            {{ fileSystemAccessState.message }}
          </p>
          <p class="text-xs mt-1">
            {{ fileSystemAccessState.hint }}
          </p>
        </div>

        <!-- 加载中 -->
        <div
          v-else-if="localIsLoading"
          class="flex flex-col items-center justify-center h-full"
        >
          <Loader2 class="h-8 w-8 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground mt-2">
            加载中...
          </p>
        </div>

        <!-- 错误提示 -->
        <div
          v-else-if="localLoadError"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-destructive"
        >
          <p class="text-sm">
            {{ localLoadError }}
          </p>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="!currentFolderHandle"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground"
        >
          <FolderOpen class="h-12 w-12 mb-2 opacity-50" />
          <p class="text-sm">
            未打开文件夹
          </p>
          <p class="text-xs mt-1">
            点击上方按钮打开本地文件夹
          </p>
        </div>

        <!-- 文件树 -->
        <div v-else class="file-tree-container">
          <div class="text-xs text-muted-foreground mb-2 px-2">
            {{ currentFolderHandle.name }}
          </div>
          <FolderTree
            :nodes="localFileTree"
            :selected-path="localSelectedFilePath"
            :expanded-paths="expandedPaths"
            @select="handleOpenFile"
            @toggle-expand="handleToggleExpand"
          />
        </div>
      </template>

      <!-- 服务器模式内容 -->
      <template v-else-if="mode === 'server'">
        <!-- 加载中 -->
        <div
          v-if="remoteIsLoading && remoteFolders.length === 0"
          class="flex flex-col items-center justify-center h-full"
        >
          <Loader2 class="h-8 w-8 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground mt-2">
            加载中...
          </p>
        </div>

        <!-- 错误提示 -->
        <div
          v-else-if="remoteLoadError"
          class="flex flex-col items-center justify-center h-full text-center p-4 text-destructive"
        >
          <p class="text-sm">
            {{ remoteLoadError }}
          </p>
        </div>

        <!-- 文件夹列表（未选择文件夹时显示） -->
        <div
          v-else-if="!remoteCurrentFolder"
          class="space-y-2"
        >
          <div class="text-xs text-muted-foreground mb-2 px-2 flex items-center gap-1">
            <Globe class="h-3 w-3" />
            服务器文件夹
          </div>

          <div
            v-if="remoteFolders.length === 0"
            class="flex flex-col items-center justify-center py-8 text-center p-4 text-muted-foreground"
          >
            <Server class="h-12 w-12 mb-2 opacity-50" />
            <p class="text-sm">
              暂无可用的服务器文件夹
            </p>
            <p class="text-xs mt-1">
              请在 .env.development 中配置 VITE_LOCAL_FOLDERS
            </p>
          </div>

          <div
            v-for="folder in remoteFolders"
            :key="folder.id"
            class="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
            @click="handleSelectRemoteFolder(folder.id)"
          >
            <!-- 彩色标签 -->
            <span
              v-if="folderConfigStore.getFolderStyle(folder.id)"
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ backgroundColor: folderConfigStore.getFolderStyle(folder.id)?.color }"
            />
            <FolderOpen v-else class="h-4 w-4 text-primary flex-shrink-0" />

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1">
                <p class="text-sm font-medium truncate">
                  {{ folder.name }}
                </p>
                <span
                  v-if="folderConfigStore.getFolderStyle(folder.id)?.label"
                  class="text-xs text-muted-foreground"
                >
                  {{ folderConfigStore.getFolderStyle(folder.id)?.label }}
                </span>
              </div>
              <p class="text-xs text-muted-foreground truncate">
                {{ folder.path }}
              </p>
            </div>

            <!-- 设置按钮 -->
            <Button
              variant="ghost"
              size="sm"
              class="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              title="设置标签和颜色"
              @click.stop="openStyleDialog(folder.id)"
            >
              <Settings class="h-3 w-3" />
            </Button>
          </div>
        </div>

        <!-- 服务器文件树 -->
        <div v-else class="file-tree-container">
          <div class="text-xs text-muted-foreground mb-2 px-2 flex items-center justify-between">
            <div class="flex items-center gap-1">
              <Server class="h-3 w-3" />
              {{ remoteCurrentFolder.name }}
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="h-5 px-1 text-[10px]"
              title="切换排序方式"
              @click="handleTreeSortModeChange"
            >
              <ArrowUpDown class="h-3 w-3 mr-0.5" />
              {{ treeSortModeLabel }}
            </Button>
          </div>

          <!-- 加载文件树中 -->
          <div
            v-if="remoteIsLoading"
            class="flex items-center justify-center py-4"
          >
            <Loader2 class="h-6 w-6 animate-spin text-primary" />
          </div>

          <FolderTree
            v-else
            :nodes="remoteFileTree"
            :selected-path="remoteSelectedFilePath"
            :expanded-paths="expandedPaths"
            :folder-styles="folderStylesMap"
            @select="handleOpenFile"
            @toggle-expand="handleToggleExpand"
          />
        </div>
      </template>
    </div>

    <!-- 标签设置对话框 -->
    <Dialog :open="showStyleDialog" @update:open="showStyleDialog = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>设置文件夹标签</DialogTitle>
          <DialogDescription>
            为文件夹设置颜色和标签，便于区分不同来源的文件。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">
              颜色
            </Label>
            <div class="col-span-3 flex gap-2 flex-wrap">
              <button
                v-for="color in folderConfigStore.colorPalette"
                :key="color"
                class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                :class="editingColor === color ? 'border-foreground' : 'border-transparent'"
                :style="{ backgroundColor: color }"
                @click="editingColor = color"
              />
            </div>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label for="label" class="text-right">
              标签
            </Label>
            <Input
              id="label"
              v-model="editingLabel"
              class="col-span-3"
              placeholder="输入标签名称（可选）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showStyleDialog = false">
            取消
          </Button>
          <Button @click="saveStyle">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.folder-source-panel {
  background-color: hsl(var(--background));
}

.panel-header {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.panel-content {
  min-height: 0;
}

.file-tree-container {
  min-height: 100%;
}

/* 移动端侧边栏动画 */
.animate-slider {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 遮罩动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
