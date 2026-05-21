# md2wechat

`md2wechat` 是一个面向微信公众号排版的 Markdown 编辑器，基于 `doocs/md` 改造，保留 Markdown 渲染、主题样式、图片上传、AI 辅助等能力，并增强了 Docker 环境下的服务器端文件管理。

## 主要功能

- Markdown 实时预览，适配微信公众号图文排版。
- 支持代码高亮、数学公式、Mermaid、PlantUML、Ruby 注音、GFM 警告块等扩展。
- 支持主题色、自定义 CSS、多图床上传和 AI 辅助写作。
- 支持 Docker 开发模式挂载服务器目录，在浏览器中打开和编辑 `.md` 文件。
- 支持 UTF-8 与 GB18030/GBK 中文 Markdown 文件读取，避免 Docker 中加载中文文件出现 `���`。
- 文件编辑默认只保存在浏览器状态中，只有点击“保存/未保存”按钮才会写回源文件。

## Docker 运行

当前仓库的 Docker 开发模式支持服务器端文件管理 API，适合把本机或服务器目录挂载进容器后直接编辑 Markdown 文件。

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://localhost:5173/md/
```

`docker-compose.yml` 中通过 `VITE_LOCAL_FOLDERS` 配置容器内可访问目录：

```yaml
environment:
  - VITE_LOCAL_FOLDERS=/app/data/5ifenxi,/app/data/www,/app/data/huishu
```

并通过 `volumes` 把宿主机目录挂载到这些容器路径。按你的实际目录修改后重新构建启动即可。

## 本地开发

环境要求：

- Node.js >= 22.16.0
- pnpm 10.x

```bash
pnpm install
pnpm web dev
```

访问：

```text
http://localhost:5173/md/
```

## 常用命令

```bash
# 类型检查
pnpm --filter @md/web type-check

# Web 构建
pnpm --filter @md/web build:only

# Docker 重建并启动
docker compose up -d --build
```

## 文件保存行为

在文件管理面板中打开 Markdown 文件后：

1. 文件内容加载到浏览器编辑器。
2. 编辑内容不会自动覆盖源文件。
3. 内容变更后按钮显示“未保存”。
4. 点击按钮后才会按原文件编码写回源文件。

这样可以避免非 UTF-8 文件被错误解码后自动写回，导致原始 Markdown 被破坏。

## 编码说明

Docker 文件 API 会先尝试 UTF-8 解码；如果检测到替换字符，会按 GB18030 解码。保存时会沿用打开文件时检测到的编码写回。

## 项目来源

本项目基于开源项目 `doocs/md` 改造。原项目地址：

```text
https://github.com/doocs/md
```

## License

MIT
