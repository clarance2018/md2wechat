FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
COPY patches/ ./patches/
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/md-cli/package.json ./packages/md-cli/

# 安装 pnpm 并安装依赖
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts

# 复制源代码
COPY . .

# 构建正式静态产物
RUN pnpm --filter @md/web build:h5-netlify:only

# ===== 运行阶段 =====
FROM node:22-alpine

WORKDIR /app/apps/web
ENV HOST=0.0.0.0
ENV PORT=80
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/web/node_modules /app/apps/web/node_modules
COPY --from=builder /app/apps/web/dist /app/apps/web/dist
COPY apps/web/server ./server

# 暴露端口
EXPOSE 80

# 启动正式服务
CMD ["node", "server/production-server.mjs"]
