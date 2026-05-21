FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
COPY patches/ ./patches/

# 安装 pnpm 并安装依赖
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm install --ignore-workspace

# 复制源代码
COPY . .

# 构建应用（跳过类型检查，直接构建）
RUN cd apps/web && npx cross-env SERVER_ENV=NETLIFY npx vite build

# ===== 运行阶段 =====
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
