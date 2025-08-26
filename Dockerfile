# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-alpine AS base

# 启用 corepack，支持 pnpm
RUN corepack enable

# 安装依赖项
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 构建应用
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建 Next.js 应用
RUN pnpm run build

# 生产镜像，复制所有文件并运行 Next.js
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 自动利用输出跟踪来减少镜像大小
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 配置文件通过挂载提供，不在构建时复制
# 创建配置文件目录以确保权限正确
RUN mkdir -p /app && chown nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
