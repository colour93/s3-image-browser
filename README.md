# S3 图片浏览器

一个现代化的 S3 存储桶文件浏览器，支持图片和视频预览、批量下载等功能。


## 技术栈

- Next.js 15 + React 18
- shadcn/ui + Radix UI
- Tailwind CSS
- Masonic
- @aws-sdk/client-s3

## 快速开始

### 1. 配置 AWS 凭证

复制并编辑配置文件：

```bash
cp config.yaml.example config.yaml
```

编辑 `config.yaml` 文件，填入你的 AWS 配置：

```yaml
aws:
  region: us-east-1
  accessKeyId: your-access-key-id
  secretAccessKey: your-secret-access-key
  bucket: your-bucket-name
  prefix: "" # 可选的前缀路径

app:
  pageSize: 50
  maxFileSize: 100MB
  supportedImageFormats: [jpg, jpeg, png, gif, webp, svg]
  supportedVideoFormats: [mp4, webm, mov, avi]
  downloadChunkSize: 1MB
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 运行开发服务器

```bash
pnpm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## Docker 部署

### 使用 Docker Compose (推荐)

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 使用 Docker

```bash
# 构建镜像
docker build -t s3-image-browser .

# 运行容器
docker run -d \\
  --name s3-image-browser \\
  -p 3000:3000 \\
  -v $(pwd)/config.yaml:/app/config.yaml:ro \\
  s3-image-browser
```

## 配置说明

### AWS 配置

- `region`: AWS 区域
- `accessKeyId`: AWS 访问密钥 ID
- `secretAccessKey`: AWS 访问密钥
- `bucket`: S3 存储桶名称
- `prefix`: 可选的路径前缀，用于限制访问范围

### 应用配置

- `pageSize`: 每页显示的文件数量
- `maxFileSize`: 支持的最大文件大小
- `supportedImageFormats`: 支持预览的图片格式
- `supportedVideoFormats`: 支持预览的视频格式
- `downloadChunkSize`: 下载时的分块大小

## 许可证

MIT License
