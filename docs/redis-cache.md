# Redis 缓存功能说明

## 概述

S3 图片浏览器现已集成 Redis 缓存功能，用于缓存 S3 文件列表查询结果，显著提升页面加载速度。

## 功能特性

- **智能缓存**: 根据查询参数（bucket、prefix、page、pageSize）生成唯一缓存键
- **24小时过期**: 缓存数据24小时后自动过期
- **缓存优先**: 优先从缓存获取数据，缓存未命中时才查询 S3
- **缓存管理**: 提供 API 和管理界面进行缓存操作
- **可配置**: 支持启用/禁用缓存功能

## 配置说明

### 1. 更新配置文件

在 `config.yaml` 中添加 Redis 配置：

```yaml
redis:
  host: localhost        # Redis 服务器地址
  port: 6379            # Redis 服务器端口
  password: ""          # Redis 密码（可选）
  db: 0                 # Redis 数据库编号（可选）
  enabled: true         # 是否启用缓存功能
```

### 2. Docker 部署

使用提供的 `docker-compose.yml` 可以同时启动应用和 Redis：

```bash
docker-compose up -d
```

这会启动：
- Redis 服务（端口 6379）
- S3 图片浏览器（端口 3000）

### 3. 本地开发

如果本地开发，需要先启动 Redis 服务：

```bash
# 使用 Docker 启动 Redis
docker run -d -p 6379:6379 --name redis redis:7-alpine

# 或者使用系统包管理器安装 Redis
# Ubuntu/Debian: sudo apt install redis-server
# macOS: brew install redis
```

## 缓存机制

### 缓存键格式

**分页数据缓存键：**
```
s3:page:{bucket}:{prefix}:{pageIndex}
```

**元数据缓存键：**
```
s3:meta:{bucket}:{prefix}
```

示例：
```
# 分页数据缓存
s3:page:my-bucket:images/2024/:0    # 第1页 (pageIndex=0)
s3:page:my-bucket:images/2024/:1    # 第2页 (pageIndex=1)
s3:page:my-bucket:images/2024/:2    # 第3页 (pageIndex=2)

# 元数据缓存
s3:meta:my-bucket:images/2024/      # 元数据（总数、文件夹等）
s3:meta:my-bucket:                  # 根目录元数据
```

### 缓存流程（支持按页索引缓存和分布式锁）

1. **查询请求** → 生成元数据缓存键、页面缓存键和锁键
2. **检查元数据缓存** → 获取总页数、文件夹列表等元信息
3. **元数据命中** → 检查页大小是否匹配，直接获取指定页面数据
4. **页面缓存命中** → 直接返回该页的对象列表
5. **缓存未命中** → 尝试获取分布式锁
   - **获取锁成功** → 查询 S3，按页分割存储，释放锁
   - **获取锁失败** → 等待锁释放（最多10秒），然后重试获取缓存
   - **等待超时** → 直接查询 S3（不缓存结果）
6. **存储缓存** → 分别存储元数据和各页数据到 Redis，设置24小时过期
7. **直接返回** → 根据页索引直接返回对应页面的数据

### 缓存内容

**元数据缓存 (`S3PrefixMeta`)：**
- **统计信息**：总文件数、总文件夹数、总页数
- **完整文件夹列表**：prefix 下所有子文件夹
- **分页配置**：页大小、根前缀
- **缓存时间**：数据缓存时间戳

**分页数据缓存 (`S3PageData`)：**
- **页面对象列表**：该页包含的所有文件对象
- **页面信息**：页索引、页大小
- **对象详情**：文件名、大小、修改时间、类型等

### 性能优势

**新的按页索引缓存策略具有以下优势：**

1. **精确缓存命中**：直接通过页索引获取数据，无需内存分页
2. **减少内存使用**：只缓存需要的页面数据，不缓存完整列表
3. **更快的响应速度**：直接从 Redis 获取页面数据，无需切片操作
4. **灵活的页大小**：支持不同页大小，自动检测并重新缓存
5. **高效的存储**：使用 Redis Pipeline 批量存储，提升性能
6. **防止缓存穿透**：分布式锁确保同一 prefix 只有一个 S3 查询
7. **智能缓存管理**：页大小变更时自动清除旧缓存

## API 接口

### 获取缓存统计

```http
GET /api/cache
```

响应：
```json
{
  "success": true,
  "message": "获取缓存统计成功",
  "data": {
    "totalKeys": 150,
    "s3PageKeys": 45,
    "s3MetaKeys": 12,
    "s3LockKeys": 3
  }
}
```

### 清除所有 S3 缓存

```http
DELETE /api/cache?action=clear-all
```

### 清除特定 Prefix 缓存

```http
DELETE /api/cache?action=clear-prefix&prefix=images/2024/
```

## 缓存管理界面

项目包含一个 `CacheManager` 组件，提供可视化的缓存管理功能：

- 查看缓存统计信息（分页缓存、元数据缓存、活跃锁数量）
- 清除所有 S3 缓存（包括所有分页和元数据）
- 按 prefix 清除特定缓存（清除该 prefix 的所有分页和元数据）
- 实时状态反馈

可以在需要的页面中引入使用：

```tsx
import { CacheManager } from '@/components/CacheManager';

export default function AdminPage() {
  return (
    <div>
      <h1>管理页面</h1>
      <CacheManager />
    </div>
  );
}
```

## 分布式锁机制

### 锁的作用

分布式锁用于防止缓存穿透问题，确保在高并发场景下：
- 同一 prefix 只有一个请求查询 S3
- 其他请求等待第一个请求完成缓存后直接使用缓存
- 避免多个相同的 S3 查询同时执行

### 锁键格式

```
s3:lock:{bucket}:{prefix}
```

示例：
```
s3:lock:my-bucket:images/2024/
s3:lock:my-bucket:documents/
```

### 锁机制参数

- **锁超时时间**: 30秒（防止死锁）
- **等待超时时间**: 10秒（避免请求长时间阻塞）
- **轮询间隔**: 100ms（检查锁释放的频率）

### 锁流程处理

1. **尝试获取锁**: 使用 Redis `SET NX EX` 命令
2. **获取成功**: 执行 S3 查询，缓存结果，释放锁
3. **获取失败**: 等待锁释放，然后重试获取缓存
4. **等待超时**: 直接查询 S3（但不缓存结果）

### 错误处理

- **锁超时**: 30秒后自动释放，防止死锁
- **等待超时**: 10秒后放弃等待，直接查询 S3
- **Redis 故障**: 锁机制失效时自动降级为直接查询

## 性能优势

启用按页索引的 Redis 缓存和分布式锁后，性能提升显著：

- **首次 prefix 查询**: 需要访问 S3，按页分割缓存所有数据
- **页面缓存命中**: 直接从 Redis 获取页面数据，响应时间 < 3ms
- **精确缓存命中**: 只获取需要的页面数据，无需内存操作
- **S3 调用优化**: 大幅减少 S3 API 调用次数和费用
- **内存使用优化**: 只缓存实际访问的页面，节省 Redis 内存
- **并发优化**: 高并发时避免重复的 S3 查询

## 监控和调试

### 日志输出

应用会在控制台输出缓存和锁相关日志：

```
Meta cache miss for prefix: images/2024/
Lock acquired for prefix: images/2024/, caching from S3...
Cached 15 pages for prefix: images/2024/
Lock released for prefix: images/2024/
Meta cache hit for prefix: images/2024/
Page 0 cache hit for prefix: images/2024/

# 并发场景下的日志
Failed to acquire lock for prefix: images/2024/, waiting for lock release...
Waiting for lock release: s3:lock:my-bucket:images/2024/, max wait: 10000ms
Lock released after 2341ms and 23 polls for key: s3:lock:my-bucket:images/2024/
Meta cache hit after lock wait for prefix: images/2024/
Page 2 cache hit for prefix: images/2024/

# 页大小不匹配的日志
Page size mismatch (cached: 50, requested: 20), clearing cache
```

### Redis 连接状态

Redis 客户端会输出连接状态日志：

```
Redis Client Connected
Redis Client Ready
```

## 故障处理

### 缓存禁用

如果 Redis 连接失败或配置 `enabled: false`，应用会：
- 跳过缓存逻辑
- 直接查询 S3
- 正常提供服务

### 缓存清理

如果需要强制刷新缓存：

1. 使用 API 清除特定 prefix 缓存
2. 使用管理界面清除所有缓存或特定 prefix 缓存
3. 重启 Redis 服务
4. 等待24小时自动过期

## 注意事项

1. **内存使用**: Redis 会占用内存存储缓存数据
2. **数据一致性**: 缓存期间 S3 的变更不会立即反映
3. **网络延迟**: Redis 服务器应该与应用部署在同一网络环境
4. **安全性**: 生产环境建议为 Redis 设置密码
