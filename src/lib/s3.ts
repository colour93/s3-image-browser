import { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerConfig } from './config';
import { isImageFile, isTextFile, isVideoFile } from './utils';
import { 
  generateCacheKey, 
  generatePageCacheKey,
  generateMetaCacheKey,
  getCachedData, 
  getCachedPage,
  setCachedData, 
  setCachedPages,
  clearPrefixCache,
  generateLockKey, 
  acquireLock, 
  releaseLock, 
  waitForLockRelease 
} from './redis';

export interface S3Object {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  isFolder: boolean;
  type: 'image' | 'video' | 'text' | 'file';
  url?: string;
}

export interface S3ListResult {
  objects: S3Object[];
  folders: S3Object[];
  totalObjects: number;
  totalFolders: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  rootPrefix: string; // 添加根前缀信息
}

export interface S3PrefixCache {
  allObjects: S3Object[];
  allFolders: S3Object[];
  totalObjects: number;
  totalFolders: number;
  rootPrefix: string;
  cachedAt: Date;
}

export interface S3PrefixMeta {
  totalObjects: number;
  totalFolders: number;
  totalPages: number;
  pageSize: number;
  allFolders: S3Object[];
  rootPrefix: string;
  cachedAt: Date;
}

export interface S3PageData {
  objects: S3Object[];
  pageIndex: number;
  pageSize: number;
}

let s3Client: S3Client | null = null;

async function getS3Client(): Promise<S3Client> {
  if (!s3Client) {
    const config = await getServerConfig();
    s3Client = new S3Client({
      region: config.aws.region,
      endpoint: config.aws.endpoint,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
      forcePathStyle: true,
      useAccelerateEndpoint: false,
    });
  }
  return s3Client;
}

// 获取总数的函数
export async function getS3ObjectsCount(prefix: string = ''): Promise<{ totalObjects: number; totalFolders: number }> {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called on the server side');
  }

  const config = await getServerConfig();
  const client = await getS3Client();
  const fullPrefix = config.aws.prefix ? `${config.aws.prefix}/${prefix}`.replace(/\/+/g, '/') : prefix;

  let totalObjects = 0;
  let totalFolders = 0;
  let continuationToken: string | undefined;
  const folderSet = new Set<string>();

  // 遍历所有对象来统计总数
  do {
    const command = new ListObjectsV2Command({
      Bucket: config.aws.bucket,
      Prefix: fullPrefix,
      Delimiter: '/',
      MaxKeys: 1000, // 使用较大的值来减少请求次数
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    // 统计文件夹
    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach(prefix => {
        if (prefix.Prefix) {
          folderSet.add(prefix.Prefix);
        }
      });
    }

    // 统计文件
    if (response.Contents) {
      totalObjects += response.Contents.filter(obj => obj.Key !== fullPrefix).length;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  totalFolders = folderSet.size;

  return { totalObjects, totalFolders };
}

// 获取并缓存完整的 prefix 数据
async function getS3PrefixData(prefix: string = ''): Promise<S3PrefixCache> {
  const config = await getServerConfig();
  const client = await getS3Client();
  const fullPrefix = config.aws.prefix ? `${config.aws.prefix}/${prefix}`.replace(/\/+/g, '/') : prefix;

  // 收集所有对象
  let allObjects: S3Object[] = [];
  let allFolders: S3Object[] = [];
  let continuationToken: string | undefined;
  const folderSet = new Set<string>();

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.aws.bucket,
      Prefix: fullPrefix,
      Delimiter: '/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    // 收集文件夹
    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach(prefixObj => {
        if (prefixObj.Prefix && !folderSet.has(prefixObj.Prefix)) {
          folderSet.add(prefixObj.Prefix);
          allFolders.push({
            key: prefixObj.Prefix,
            name: prefixObj.Prefix.replace(fullPrefix, '').replace('/', ''),
            size: 0,
            lastModified: new Date(),
            isFolder: true,
            type: 'file' as const,
          });
        }
      });
    }

    // 收集文件
    if (response.Contents) {
      const objects = response.Contents
        .filter(obj => obj.Key !== fullPrefix)
        .map(obj => {
          const name = obj.Key!.replace(fullPrefix, '').replace(/^\//, '');
          let type: S3Object['type'] = 'file';

          if (isImageFile(name)) {
            type = 'image';
          } else if (isVideoFile(name)) {
            type = 'video';
          } else if (isTextFile(name)) {
            type = 'text';
          }

          return {
            key: obj.Key!,
            name,
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
            isFolder: false,
            type,
          };
        });

      allObjects.push(...objects);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return {
    allObjects,
    allFolders,
    totalObjects: allObjects.length,
    totalFolders: allFolders.length,
    rootPrefix: config.aws.prefix || '',
    cachedAt: new Date(),
  };
}

// 缓存分页数据的新函数
async function cacheS3PrefixData(prefix: string = '', pageSize: number = 50): Promise<S3PrefixMeta> {
  const prefixData = await getS3PrefixData(prefix);
  const config = await getServerConfig();
  
  // 计算总页数
  const totalPages = Math.ceil(prefixData.totalObjects / pageSize);
  
  // 创建元数据
  const metaData: S3PrefixMeta = {
    totalObjects: prefixData.totalObjects,
    totalFolders: prefixData.totalFolders,
    totalPages,
    pageSize,
    allFolders: prefixData.allFolders,
    rootPrefix: prefixData.rootPrefix,
    cachedAt: new Date(),
  };
  
  // 存储元数据
  const metaKey = generateMetaCacheKey(config.aws.bucket, prefix);
  await setCachedData(metaKey, metaData, 86400);
  
  // 分页存储对象数据
  const pages: { pageIndex: number; data: S3PageData }[] = [];
  
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const startIndex = pageIndex * pageSize;
    const endIndex = Math.min(startIndex + pageSize, prefixData.totalObjects);
    const pageObjects = prefixData.allObjects.slice(startIndex, endIndex);
    
    const pageData: S3PageData = {
      objects: pageObjects,
      pageIndex,
      pageSize,
    };
    
    pages.push({ pageIndex, data: pageData });
  }
  
  // 批量存储分页数据
  if (pages.length > 0) {
    await setCachedPages(config.aws.bucket, prefix, pages, 86400);
  }
  
  console.log(`Cached ${totalPages} pages for prefix: ${prefix}`);
  
  return metaData;
}

// 修改后的分页列表函数（支持按页索引的 Redis 缓存和分布式锁）
export async function listS3Objects(
  prefix: string = '',
  page: number = 1,
  pageSize: number = 50
): Promise<S3ListResult> {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called on the server side');
  }

  const config = await getServerConfig();
  const pageIndex = page - 1; // 转换为0基索引
  
  // 生成缓存键和锁键
  const metaKey = generateMetaCacheKey(config.aws.bucket, prefix);
  const lockKey = generateLockKey(config.aws.bucket, prefix);
  
  // 尝试获取元数据
  let metaData = await getCachedData<S3PrefixMeta>(metaKey);
  
  if (metaData) {
    console.log(`Meta cache hit for prefix: ${prefix}`);
    
    // 检查页大小是否匹配
    if (metaData.pageSize !== pageSize) {
      console.log(`Page size mismatch (cached: ${metaData.pageSize}, requested: ${pageSize}), clearing cache`);
      await clearPrefixCache(config.aws.bucket, prefix);
      metaData = null;
    }
  }
  
  if (!metaData) {
    console.log(`Meta cache miss for prefix: ${prefix}`);
    
    // 尝试获取分布式锁
    const lockAcquired = await acquireLock(lockKey, 30); // 30秒锁超时
    
    if (lockAcquired) {
      console.log(`Lock acquired for prefix: ${prefix}, caching from S3...`);
      
      try {
        // 再次检查元数据缓存（可能在等待锁期间其他进程已经缓存了数据）
        metaData = await getCachedData<S3PrefixMeta>(metaKey);
        
        if (!metaData || metaData.pageSize !== pageSize) {
          // 清除旧缓存（如果存在页大小不匹配的情况）
          if (metaData && metaData.pageSize !== pageSize) {
            await clearPrefixCache(config.aws.bucket, prefix);
          }
          
          // 从 S3 获取数据并分页缓存
          metaData = await cacheS3PrefixData(prefix, pageSize);
          console.log(`Cached ${metaData.totalPages} pages for prefix: ${prefix}`);
        } else {
          console.log(`Meta cache hit after lock acquisition for prefix: ${prefix}`);
        }
      } finally {
        // 确保锁被释放
        await releaseLock(lockKey);
        console.log(`Lock released for prefix: ${prefix}`);
      }
    } else {
      console.log(`Failed to acquire lock for prefix: ${prefix}, waiting for lock release...`);
      
      // 等待锁释放
      const lockReleased = await waitForLockRelease(lockKey, 10000); // 最多等待10秒
      
      if (lockReleased) {
        // 锁释放后再次尝试从缓存获取元数据
        metaData = await getCachedData<S3PrefixMeta>(metaKey);
        
        if (!metaData) {
          console.warn(`No meta cache found after lock wait for prefix: ${prefix}, falling back to direct S3 query`);
          // 如果仍然没有缓存数据，直接查询（不缓存结果）
          const prefixData = await getS3PrefixData(prefix);
          const totalPages = Math.ceil(prefixData.totalObjects / pageSize);
          const startIndex = pageIndex * pageSize;
          const endIndex = Math.min(startIndex + pageSize, prefixData.totalObjects);
          const paginatedObjects = prefixData.allObjects.slice(startIndex, endIndex);
          
          return {
            objects: paginatedObjects,
            folders: prefixData.allFolders,
            totalObjects: prefixData.totalObjects,
            totalFolders: prefixData.totalFolders,
            currentPage: page,
            totalPages,
            pageSize,
            rootPrefix: prefixData.rootPrefix,
          };
        } else {
          console.log(`Meta cache hit after lock wait for prefix: ${prefix}`);
        }
      } else {
        console.error(`Lock wait timeout or error for prefix: ${prefix}, falling back to direct S3 query`);
        // 锁等待超时或出错，直接查询 S3（不缓存结果）
        const prefixData = await getS3PrefixData(prefix);
        const totalPages = Math.ceil(prefixData.totalObjects / pageSize);
        const startIndex = pageIndex * pageSize;
        const endIndex = Math.min(startIndex + pageSize, prefixData.totalObjects);
        const paginatedObjects = prefixData.allObjects.slice(startIndex, endIndex);
        
        return {
          objects: paginatedObjects,
          folders: prefixData.allFolders,
          totalObjects: prefixData.totalObjects,
          totalFolders: prefixData.totalFolders,
          currentPage: page,
          totalPages,
          pageSize,
          rootPrefix: prefixData.rootPrefix,
        };
      }
    }
  }

  // 现在有了元数据，尝试获取特定页的数据
  const pageData = await getCachedPage<S3PageData>(config.aws.bucket, prefix, pageIndex);
  
  if (!pageData) {
    console.warn(`Page ${pageIndex} cache miss for prefix: ${prefix}, falling back to direct query`);
    // 页面缓存缺失，直接查询 S3（这种情况很少发生）
    const prefixData = await getS3PrefixData(prefix);
    const startIndex = pageIndex * pageSize;
    const endIndex = Math.min(startIndex + pageSize, prefixData.totalObjects);
    const paginatedObjects = prefixData.allObjects.slice(startIndex, endIndex);
    
    return {
      objects: paginatedObjects,
      folders: metaData.allFolders,
      totalObjects: metaData.totalObjects,
      totalFolders: metaData.totalFolders,
      currentPage: page,
      totalPages: metaData.totalPages,
      pageSize,
      rootPrefix: metaData.rootPrefix,
    };
  }

  console.log(`Page ${pageIndex} cache hit for prefix: ${prefix}`);

  return {
    objects: pageData.objects,
    folders: metaData.allFolders, // 文件夹始终显示所有
    totalObjects: metaData.totalObjects,
    totalFolders: metaData.totalFolders,
    currentPage: page,
    totalPages: metaData.totalPages,
    pageSize,
    rootPrefix: metaData.rootPrefix,
  };
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called on the server side');
  }
  const config = await getServerConfig();
  const client = await getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.aws.bucket,
    Key: key,
  });

  try {
    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

export async function getObjectInfo(key: string): Promise<{ size: number; lastModified: Date; contentType?: string }> {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called on the server side');
  }
  const config = await getServerConfig();
  const client = await getS3Client();

  const command = new HeadObjectCommand({
    Bucket: config.aws.bucket,
    Key: key,
  });

  try {
    const response = await client.send(command);
    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType,
    };
  } catch (error) {
    console.error('Error getting object info:', error);
    throw new Error('Failed to get file information');
  }
}
