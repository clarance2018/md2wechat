# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**doocs/md** — 微信 Markdown 编辑器，支持 Markdown 语法、自定义主题、多图床、AI 助手等特性。基于 pnpm monorepo 架构，包含 Web 应用、VSCode 插件、CLI 工具等。

## 常用命令

```bash
# 安装依赖
pnpm install

# 开发模式（访问 http://localhost:5173/md/）
pnpm web dev

# 生产构建（部署在 /md 目录）
pnpm web build

# 生产构建（部署在根目录）
pnpm web build:h5-netlify

# 代码检查（ESLint + Prettier）
pnpm run lint

# TypeScript 类型检查
pnpm run type-check

# Chrome 扩展开发调试
pnpm web ext:dev

# Chrome 扩展打包
pnpm web ext:zip

# Firefox 扩展打包
pnpm web firefox:zip

# uTools 插件打包
pnpm utools:package

# Cloudflare Workers
pnpm web wrangler:dev    # 开发模式
pnpm web wrangler:deploy # 部署

# CLI 构建
pnpm run build:cli
```

## Monorepo 结构

```
- apps/
  - web           # 主应用（Web + 浏览器扩展），Vue 3 + Vite + Pinia + Tailwind CSS
  - vscode        # VSCode 插件
  - utools        # uTools 插件
- packages/
  - core          # 核心 Markdown 渲染引擎（基于 marked，支持 Mermaid/PlantUML/Ruby 等扩展）
  - shared        # 共享配置、常量、类型和工具函数
  - config        # 项目级别配置
  - mcp-server    # MCP Server
  - md-cli        # 命令行工具（@doocs/md-cli）
  - example       # 公众号 openapi 接口代理服务示例
```

## 关键架构

### 渲染引擎 (`packages/core`)

- 基于 `marked` 实现 Markdown 解析
- 自定义扩展在 `packages/core/src/extensions/` 目录
- 主题系统在 `packages/core/src/theme/`，通过注入 CSS 变量到 DOM 实现

### Web 应用 (`apps/web`)

- Vue 3 Composition API + Pinia 状态管理
- 编辑器组件使用 CodeMirror 6
- UI 组件使用 Shadcn-Vue 风格（`apps/web/src/components/ui`）
- Pinia stores 按领域划分（`useEditorStore`、`useThemeStore`、`useUiStore`）
- 浏览器扩展通过 WXT 框架支持

### 包引用方式

`@md/core` 和 `@md/shared` 直接导出 TypeScript 源码（`src/index.ts`），无需单独构建，由消费方的构建工具（Vite）编译。

## 代码规范

- **ESLint 配置**：使用 `@antfu/eslint-config`，无分号风格
- **代码风格**：2 空格缩进，UTF-8，LF 换行符
- **格式化**：所有提交必须通过 `pnpm run lint` 检查
- **Pre-commit Hook**：通过 `simple-git-hooks` + `lint-staged` 自动执行 ESLint

## Git 规范

### Commit Message

遵循 Conventional Commits：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码格式（不影响逻辑）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `build`: 构建系统或依赖变动
- `chore`: 其他辅助变动

### Branch 命名

```
feat/<简要描述>
fix/<简要描述>
docs/<简要描述>
```

## 环境要求

- Node.js >= 22.16.0（见 `.nvmrc`）
- pnpm >= 10

## Docker 部署

### 开发模式（支持文件管理功能）

使用 `Dockerfile.dev` 构建，支持服务器端文件管理、热重载和 API 接口。

```bash
# 构建镜像
docker build -f Dockerfile.dev -t md-editor-dev:latest .

# 运行容器（挂载本地文件夹用于文件管理）
docker run -d \
  --name md-editor-dev \
  -p 5173:5173 \
  -v /path/to/your/files:/app/data \
  -e HOST=0.0.0.0 \
  -e PORT=5173 \
  -e VITE_LOCAL_FOLDERS=/app/data/folder1,/app/data/folder2 \
  md-editor-dev:latest
```

或使用 docker-compose：

```bash
# 使用 docker-compose.local.yml（最简单）
docker-compose -f docker-compose.local.yml up -d

# 使用 docker-compose.yml（支持源码热重载）
docker-compose up -d
```

访问 http://localhost:5173 即可使用。

### 生产模式

使用 `Dockerfile.static` 构建，镜像小、性能高，但不支持文件管理功能。

```bash
docker build -f Dockerfile.static -t md-editor-static:latest .
docker run -d -p 8080:80 md-editor-static:latest
```

### 文件管理配置

文件管理通过 `VITE_LOCAL_FOLDERS` 环境变量配置可访问的服务器文件夹路径，多个路径用逗号分隔。对应的 Vite 插件在 `apps/web/plugins/vite-plugin-local-folder.ts`，提供 REST API：

- `GET /api/local-folders` - 获取文件夹列表
- `GET /api/local-folders/:id/tree` - 获取文件树
- `GET /api/local-folders/:id/file` - 读取文件内容
- `PUT /api/local-folders/:id/file` - 保存文件内容

## 开发调试提示

在 `apps/web` 目录下新建 `.env.local` 文件，配置 `VITE_LAUNCH_EDITOR` 可指定调试编辑器：

```
VITE_LAUNCH_EDITOR=cursor
```
