import { createClient, RedisClientType } from 'redis';
import { getServerConfig } from './config';

let redisClient: RedisClientType | null = null;

/**
 * 获取 Redis 客户端实例
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (typeof window !== 'undefined') {
    throw new Error('Redis client can only be used on the server side');
  }

  const config = await getServerConfig();
  
  // 如果 Redis 未启用，返回 null
  if (!config.redis.enabled) {
    return null;
  }

  // 如果已有连接且状态正常，直接返回
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }

  try {
    // 构建 Redis 连接配置
    const redisConfig: any = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
    };

    // 添加密码（如果有）
    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }

    // 添加数据库编号（如果有）
    if (config.redis.db !== undefined) {
      redisConfig.database = config.redis.db;
    }

    // 创建客户端
    redisClient = createClient(redisConfig);

    // 添加错误处理
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      console.log('Redis Client Ready');
    });

    redisClient.on('end', () => {
      console.log('Redis Client Connection Ended');
    });

    // 连接到 Redis
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    redisClient = null;
    return null;
  }
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient && redisClient.isReady) {
    try {
      await redisClient.quit();
      redisClient = null;
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}

/**
 * 生成缓存键（基于 prefix 和页面索引）
 */
export function generateCacheKey(bucket: string, prefix: string, pageIndex?: number): string {
  // 清理 prefix，移除前后的斜杠
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  
  if (pageIndex !== undefined) {
    // 分页数据缓存键
    return `s3:page:${bucket}:${cleanPrefix}:${pageIndex}`;
  } else {
    // 元数据缓存键
    return `s3:meta:${bucket}:${cleanPrefix}`;
  }
}

/**
 * 生成分页数据缓存键
 */
export function generatePageCacheKey(bucket: string, prefix: string, pageIndex: number): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return `s3:page:${bucket}:${cleanPrefix}:${pageIndex}`;
}

/**
 * 生成元数据缓存键
 */
export function generateMetaCacheKey(bucket: string, prefix: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return `s3:meta:${bucket}:${cleanPrefix}`;
}

/**
 * 从 Redis 获取缓存数据
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const cachedData = await client.get(key);

    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData) as T;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

/**
 * 将数据存储到 Redis 缓存
 */
export async function setCachedData<T>(key: string, data: T, expireInSeconds: number = 86400): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    const serializedData = JSON.stringify(data);
    await client.setEx(key, expireInSeconds, serializedData);
    
    return true;
  } catch (error) {
    console.error('Error setting cached data:', error);
    return false;
  }
}

/**
 * 批量存储分页数据到 Redis
 */
export async function setCachedPages<T>(
  bucket: string, 
  prefix: string, 
  pages: { pageIndex: number; data: T }[], 
  expireInSeconds: number = 86400
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    // 使用 pipeline 批量设置
    const pipeline = client.multi();
    
    for (const page of pages) {
      const cacheKey = generatePageCacheKey(bucket, prefix, page.pageIndex);
      const serializedData = JSON.stringify(page.data);
      pipeline.setEx(cacheKey, expireInSeconds, serializedData);
    }

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Error setting cached pages:', error);
    return false;
  }
}

/**
 * 获取特定页的缓存数据
 */
export async function getCachedPage<T>(bucket: string, prefix: string, pageIndex: number): Promise<T | null> {
  const cacheKey = generatePageCacheKey(bucket, prefix, pageIndex);
  return await getCachedData<T>(cacheKey);
}

/**
 * 删除缓存数据
 */
export async function deleteCachedData(key: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    await client.del(key);
    return true;
  } catch (error) {
    console.error('Error deleting cached data:', error);
    return false;
  }
}

/**
 * 清除所有 S3 相关的缓存
 */
export async function clearS3Cache(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    // 查找所有 s3:page:* 和 s3:meta:* 的键
    const pageKeys = await client.keys('s3:page:*');
    const metaKeys = await client.keys('s3:meta:*');
    const allKeys = [...pageKeys, ...metaKeys];
    
    if (allKeys.length > 0) {
      await client.del(allKeys);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing S3 cache:', error);
    return false;
  }
}

/**
 * 清除特定 prefix 的所有缓存（包括所有分页和元数据）
 */
export async function clearPrefixCache(bucket: string, prefix: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    
    // 查找该 prefix 的所有分页和元数据键
    const pageKeys = await client.keys(`s3:page:${bucket}:${cleanPrefix}:*`);
    const metaKey = generateMetaCacheKey(bucket, prefix);
    const metaExists = await client.exists(metaKey);
    
    const keysToDelete = [...pageKeys];
    if (metaExists) {
      keysToDelete.push(metaKey);
    }
    
    if (keysToDelete.length > 0) {
      await client.del(keysToDelete);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing prefix cache:', error);
    return false;
  }
}

/**
 * 获取分布式锁
 */
export async function acquireLock(lockKey: string, expireSeconds: number = 30): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    // 使用 SET NX EX 命令获取锁
    const result = await client.set(lockKey, '1', {
      NX: true, // 只有当键不存在时才设置
      EX: expireSeconds, // 设置过期时间
    });

    return result === 'OK';
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
}

/**
 * 释放分布式锁
 */
export async function releaseLock(lockKey: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    await client.del(lockKey);
    return true;
  } catch (error) {
    console.error('Error releasing lock:', error);
    return false;
  }
}

/**
 * 等待锁释放（轮询方式）
 */
export async function waitForLockRelease(lockKey: string, maxWaitMs: number = 10000): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  const startTime = Date.now();
  const pollInterval = 100; // 100ms 轮询间隔
  let pollCount = 0;

  console.log(`Waiting for lock release: ${lockKey}, max wait: ${maxWaitMs}ms`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const exists = await client.exists(lockKey);
      if (!exists) {
        console.log(`Lock released after ${Date.now() - startTime}ms and ${pollCount} polls for key: ${lockKey}`);
        return true; // 锁已释放
      }
      
      pollCount++;
      // 等待一小段时间后再次检查
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error(`Error checking lock existence for key ${lockKey}:`, error);
      // 发生错误时也返回 false，让调用者决定如何处理
      return false;
    }
  }

  // 超时
  console.warn(`Lock wait timeout for key: ${lockKey} after ${maxWaitMs}ms and ${pollCount} polls`);
  return false;
}

/**
 * 生成锁键
 */
export function generateLockKey(bucket: string, prefix: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return `s3:lock:${bucket}:${cleanPrefix}`;
}

/**
 * 检查锁是否存在
 */
export async function isLockExists(lockKey: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return false;
    }

    const exists = await client.exists(lockKey);
    return exists === 1;
  } catch (error) {
    console.error('Error checking lock existence:', error);
    return false;
  }
}

/**
 * 获取锁的剩余 TTL（秒）
 */
export async function getLockTTL(lockKey: string): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return -1;
    }

    const ttl = await client.ttl(lockKey);
    return ttl;
  } catch (error) {
    console.error('Error getting lock TTL:', error);
    return -1;
  }
}

/**
 * 清理所有过期的锁（用于维护）
 */
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return 0;
    }

    // 查找所有锁键
    const lockKeys = await client.keys('s3:lock:*');
    let cleanedCount = 0;

    for (const lockKey of lockKeys) {
      const ttl = await client.ttl(lockKey);
      // TTL 为 -1 表示没有过期时间，-2 表示键不存在
      if (ttl === -2) {
        cleanedCount++;
      }
    }

    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up expired locks:', error);
    return 0;
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  s3PageKeys: number;
  s3MetaKeys: number;
  s3LockKeys: number;
} | null> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const pageKeys = await client.keys('s3:page:*');
    const metaKeys = await client.keys('s3:meta:*');
    const lockKeys = await client.keys('s3:lock:*');
    const dbSize = await client.dbSize();
    
    return {
      totalKeys: dbSize,
      s3PageKeys: pageKeys.length,
      s3MetaKeys: metaKeys.length,
      s3LockKeys: lockKeys.length,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}
