# Docker 部署指南

## 修改后的版本（支持文件管理功能）

这个版本添加了"文件管理"功能，可以管理服务器端的本地文件夹。

## 快速开始

### 方式一：使用 docker-compose（推荐）

```bash
# 1. 构建并启动容器
docker-compose up -d

# 2. 访问编辑器
# 浏览器打开 http://localhost:5173
```

### 方式二：使用 docker-compose.local.yml（最简单）

```bash
# 1. 构建并启动容器
docker-compose -f docker-compose.local.yml up -d

# 2. 访问编辑器
# 浏览器打开 http://localhost:5173
```

### 方式三：手动构建和运行

```bash
# 1. 构建镜像
docker build -f Dockerfile.dev -t md-editor-dev:latest .

# 2. 运行容器
docker run -d \
  --name md-editor-dev \
  -p 5173:5173 \
  -v /home/clarance/claude:/app/data \
  -e HOST=0.0.0.0 \
  -e PORT=5173 \
  -e VITE_LOCAL_FOLDERS=/app/data/5ifenxi/output,/app/data/www/output,/app/data/huishu/output \
  md-editor-dev:latest
```

## 配置说明

### 文件夹配置

在 `.env.development` 文件中配置要访问的本地文件夹：

```bash
VITE_LOCAL_FOLDERS=/path/to/folder1,/path/to/folder2,/path/to/folder3
```

### Docker 卷挂载

在 `docker-compose.yml` 中配置卷挂载：

```yaml
volumes:
  # 格式：本地路径:容器内路径
  - /home/clarance/claude/5ifenxi/output:/app/data/5ifenxi
  - /home/clarance/claude/www/output:/app/data/www
  - /home/clarance/claude/huishu/output:/app/data/huishu
```

## 功能特性

### 文件管理功能

1. **服务器模式** - 访问服务器端的本地文件夹
2. **本地模式** - 访问浏览器本地的文件夹（需要浏览器支持 File System Access API）
3. **文件树浏览** - 支持文件夹展开/折叠
4. **文件读取** - 打开并编辑 Markdown 文件
5. **文件保存** - 自动同步编辑内容到服务器
6. **排序功能** - 支持按名称或时间排序

### API 接口

文件管理功能通过以下 REST API 实现：

- `GET /api/local-folders` - 获取文件夹列表
- `GET /api/local-folders/:id/tree` - 获取文件树
- `GET /api/local-folders/:id/file` - 读取文件内容
- `PUT /api/local-folders/:id/file` - 保存文件内容

## 常用命令

```bash
# 查看容器状态
docker ps | grep md-editor

# 查看容器日志
docker logs md-editor-dev

# 停止容器
docker stop md-editor-dev

# 启动容器
docker start md-editor-dev

# 重启容器
docker restart md-editor-dev

# 进入容器
docker exec -it md-editor-dev sh

# 删除容器
docker rm -f md-editor-dev

# 删除镜像
docker rmi md-editor-dev:latest
```

## 故障排除

### 1. 文件夹无法访问

检查卷挂载是否正确：

```bash
# 进入容器检查
docker exec -it md-editor-dev sh
ls -la /app/data/
```

### 2. API 接口 404

确保使用的是开发模式（Dockerfile.dev），而不是生产模式。

### 3. 权限问题

确保挂载的文件夹有正确的读写权限：

```bash
# 修改文件夹权限
chmod -R 755 /home/clarance/claude
```

## 开发模式 vs 生产模式

### 开发模式（Dockerfile.dev）

- ✅ 支持文件管理功能
- ✅ 支持热重载
- ✅ 支持 API 接口
- ❌ 性能较低
- ❌ 镜像较大

### 生产模式（Dockerfile.static）

- ❌ 不支持文件管理功能
- ❌ 不支持热重载
- ❌ 不支持 API 接口
- ✅ 性能高
- ✅ 镜像小（2.79 MB）

## 注意事项

1. **安全性** - 文件管理功能只在开发模式下可用，生产环境请勿使用
2. **路径配置** - 确保容器内外的路径映射正确
3. **权限设置** - 确保容器有权限访问挂载的文件夹
4. **端口冲突** - 如果端口 5173 被占用，可以修改 docker-compose.yml 中的端口映射

## 技术支持

如有问题，请检查：

1. Docker 是否正常运行
2. 卷挂载路径是否正确
3. 环境变量是否配置正确
4. 容器日志是否有错误信息
