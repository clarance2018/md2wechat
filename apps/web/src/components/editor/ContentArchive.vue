<script setup lang="ts">
import type { Post } from '@/types/post'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Trash2,
} from '@lucide/vue'
import { useFolderConfigStore } from '@/stores/folderConfig'
import { usePostStore } from '@/stores/post'

const postStore = usePostStore()
const folderConfigStore = useFolderConfigStore()

interface ArchiveGroup {
  key: string
  label: string
  icon: any
  posts: Post[]
}

function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Expanded group keys (reactive Set - fixes previous expand/collapse bug)
const expandedKeys = ref<Set<string>>(new Set(['today', 'yesterday']))

function isExpanded(key: string): boolean {
  return expandedKeys.value.has(key)
}

function toggleGroup(key: string) {
  const newSet = new Set(expandedKeys.value)
  if (newSet.has(key)) {
    newSet.delete(key)
  }
  else {
    newSet.add(key)
  }
  expandedKeys.value = newSet
}

// Archive groups computed
const archiveGroups = computed<ArchiveGroup[]>(() => {
  const now = new Date()
  const groups: ArchiveGroup[] = [
    { key: 'today', label: '今天', icon: Clock, posts: [] },
    { key: 'yesterday', label: '昨天', icon: Clock, posts: [] },
    { key: 'this-week', label: '本周', icon: Calendar, posts: [] },
    { key: 'older', label: '更早', icon: Calendar, posts: [] },
  ]

  const posts = postStore.posts || []

  posts.forEach((post) => {
    const updateDate = new Date(post.updateDatetime)
    const diff = daysBetween(updateDate, now)

    if (diff === 0) {
      groups[0].posts.push(post)
    }
    else if (diff === 1) {
      groups[1].posts.push(post)
    }
    else if (diff <= 7) {
      groups[2].posts.push(post)
    }
    else {
      groups[3].posts.push(post)
    }
  })

  // Sort posts within each group by update time (newest first)
  groups.forEach((group) => {
    group.posts.sort((a, b) =>
      new Date(b.updateDatetime).getTime() - new Date(a.updateDatetime).getTime(),
    )
  })

  return groups
})

// Get folder style for a post
function getPostFolderStyle(post: Post) {
  if (!post.sourceFolderId)
    return null
  return folderConfigStore.getFolderStyle(post.sourceFolderId)
}

// Delete confirmation state
const showDeleteConfirm = ref(false)
const deleteTarget = ref<{ type: 'single' | 'group', id?: string, groupKey?: string } | null>(null)

function confirmDelete(postId: string) {
  deleteTarget.value = { type: 'single', id: postId }
  showDeleteConfirm.value = true
}

function confirmDeleteGroup(groupKey: string) {
  deleteTarget.value = { type: 'group', groupKey }
  showDeleteConfirm.value = true
}

function executeDelete() {
  if (!deleteTarget.value)
    return

  if (deleteTarget.value.type === 'single' && deleteTarget.value.id) {
    postStore.delPost(deleteTarget.value.id)
    toast.success('文章已删除')
  }
  else if (deleteTarget.value.type === 'group' && deleteTarget.value.groupKey) {
    const group = archiveGroups.value.find(g => g.key === deleteTarget.value!.groupKey)
    if (group) {
      const count = group.posts.length
      group.posts.forEach(post => postStore.delPost(post.id))
      toast.success(`已删除 ${count} 篇文章`)
    }
  }

  showDeleteConfirm.value = false
  deleteTarget.value = null
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

function openPost(post: Post) {
  postStore.currentPostId = post.id
}
</script>

<template>
  <div class="content-archive h-full flex flex-col">
    <!-- 标题 -->
    <div class="px-3 py-2 border-b">
      <h3 class="text-sm font-semibold flex items-center gap-2">
        <FileText class="h-4 w-4" />
        内容管理
      </h3>
      <p class="text-xs text-muted-foreground mt-1">
        按编辑时间归档，共 {{ postStore.posts?.length || 0 }} 篇文章
      </p>
    </div>

    <!-- 归档列表 -->
    <div class="flex-1 overflow-y-auto p-2">
      <div
        v-for="group in archiveGroups"
        :key="group.key"
        class="mb-2"
      >
        <!-- 分组标题 -->
        <div
          class="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
          @click="toggleGroup(group.key)"
        >
          <div class="flex items-center gap-2">
            <component
              :is="isExpanded(group.key) ? ChevronDown : ChevronRight"
              class="h-4 w-4 text-muted-foreground"
            />
            <component :is="group.icon" class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">
              {{ group.label }}
            </span>
            <span class="text-xs text-muted-foreground">
              ({{ group.posts.length }})
            </span>
          </div>

          <!-- 删除按钮 -->
          <Button
            v-if="group.posts.length > 0"
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:text-destructive"
            title="删除分组"
            @click.stop="confirmDeleteGroup(group.key)"
          >
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>

        <!-- 文章列表 -->
        <Transition name="expand">
          <div v-if="isExpanded(group.key) && group.posts.length > 0" class="ml-4 mt-1 space-y-1">
            <div
              v-for="post in group.posts"
              :key="post.id"
              class="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
              @click="openPost(post)"
            >
              <div class="flex-1 min-w-0 flex items-center gap-1.5">
                <!-- 彩色标签 -->
                <span
                  v-if="getPostFolderStyle(post)"
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: getPostFolderStyle(post)?.color }"
                  :title="getPostFolderStyle(post)?.label"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm truncate">
                    {{ post.title || '无标题' }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(post.updateDatetime) }}
                    <span
                      v-if="getPostFolderStyle(post)?.label"
                      class="ml-1"
                    >
                      {{ getPostFolderStyle(post)?.label }}
                    </span>
                  </p>
                </div>
              </div>

              <!-- 删除按钮 -->
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive flex-shrink-0"
                title="删除文章"
                @click.stop="confirmDelete(post.id)"
              >
                <Trash2 class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Transition>

        <!-- 空状态 -->
        <div
          v-if="isExpanded(group.key) && group.posts.length === 0"
          class="ml-4 mt-1 px-2 py-2 text-xs text-muted-foreground"
        >
          暂无文章
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <AlertDialog :open="showDeleteConfirm" @update:open="showDeleteConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="deleteTarget?.type === 'single'">
              确定要删除这篇文章吗？此操作不可撤销。
            </template>
            <template v-else-if="deleteTarget?.type === 'group'">
              确定要删除该分组中的所有文章吗？此操作不可撤销。
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelDelete">
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="executeDelete"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped>
.content-archive {
  background-color: hsl(var(--background));
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
