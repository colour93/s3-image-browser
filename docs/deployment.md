# 部署配置指南

## 子路径部署

本项目支持通过 nginx 等反向代理服务器部署在子路径下。

### 配置步骤

#### 1. 设置环境变量

在部署时设置 `BASE_PATH` 环境变量：

```bash
# 例如部署在 /oss-manage 路径下
export BASE_PATH=/oss-manage
```

或者在 `.env.local` 文件中设置：

```bash
BASE_PATH=/oss-manage
```

#### 2. 构建应用

```bash
pnpm run build
```

#### 3. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 反向代理到 Next.js 应用
    location /oss-manage/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 处理静态资源
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
    }

    # 可选：处理静态资源缓存
    location /oss-manage/_next/static/ {
        proxy_pass http://localhost:3000/_next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 4. Docker 部署示例

**重要**: Docker 部署时，配置文件通过挂载提供，而不是复制到镜像中。

```bash
# 构建镜像（支持子路径）
docker build --build-arg BASE_PATH=/oss-manage -t s3-browser .

# 运行容器（挂载配置文件）
docker run -d \
  --name s3-browser \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e BASE_PATH=/oss-manage \
  s3-browser
```

**Docker Compose 部署**:

```yaml
version: '3.8'
services:
  s3-browser:
    build:
      context: .
      args:
        BASE_PATH: /oss-manage
    volumes:
      # 挂载配置文件（只读）
      - ./config.yaml:/app/config.yaml:ro
    environment:
      - BASE_PATH=/oss-manage
    ports:
      - "3000:3000"
```

```bash
# 使用环境变量部署
BASE_PATH=/oss-manage docker-compose up --build -d
```

#### 5. 启动应用

```bash
# 开发环境
BASE_PATH=/oss-manage pnpm run dev

# 生产环境
BASE_PATH=/oss-manage pnpm start
```

### 访问地址

配置完成后，应用将可以通过以下地址访问：

- 根路径部署：`http://your-domain.com/`
- 子路径部署：`http://your-domain.com/oss-manage/`

### 注意事项

1. **BASE_PATH 必须以 `/` 开头，不能以 `/` 结尾**
   - ✅ 正确：`/oss-manage`
   - ❌ 错误：`oss-manage` 或 `/oss-manage/`

2. **配置文件挂载**
   - Docker 部署时必须挂载 `config.yaml` 文件
   - 使用只读挂载 (`ro`) 提高安全性
   - 确保配置文件路径正确：`./config.yaml:/app/config.yaml:ro`
   - Windows 用户使用：`%cd%\config.yaml:/app/config.yaml:ro`

3. **静态资源路径**
   - Next.js 会自动处理静态资源的路径前缀
   - CSS、JS、图片等资源会自动添加 basePath

4. **API 路由**
   - API 路由会自动添加 basePath 前缀
   - 例如：`/api/files` 会变成 `/oss-manage/api/files`

5. **客户端路由**
   - 所有客户端路由都会自动添加 basePath 前缀
   - URL 参数和导航功能正常工作

### 故障排除

如果遇到问题，请检查：

1. **环境变量是否正确设置**
   ```bash
   echo $BASE_PATH
   ```

2. **配置文件是否正确挂载**
   ```bash
   # 检查容器内的配置文件
   docker exec -it s3-browser ls -la /app/config.yaml
   
   # 检查配置文件内容
   docker exec -it s3-browser cat /app/config.yaml
   ```

3. **Nginx 配置是否正确**
   - 确保代理路径匹配
   - 检查 proxy_pass 配置

4. **应用是否正确构建**
   ```bash
   pnpm run build
   ```

5. **Docker 挂载路径是否正确**
   - Linux/Mac: `-v $(pwd)/config.yaml:/app/config.yaml:ro`
   - Windows: `-v %cd%\config.yaml:/app/config.yaml:ro`
   - 确保当前目录存在 `config.yaml` 文件

6. **静态资源是否正确加载**
   - 检查浏览器开发者工具的网络选项卡
   - 确认资源路径包含正确的前缀
