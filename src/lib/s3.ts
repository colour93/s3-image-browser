import { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerConfig } from './config';
import { isImageFile, isTextFile, isVideoFile } from './utils';

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

// 修改后的分页列表函数
export async function listS3Objects(
  prefix: string = '',
  page: number = 1,
  pageSize: number = 50
): Promise<S3ListResult> {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called on the server side');
  }

  const config = await getServerConfig();
  const client = await getS3Client();
  const fullPrefix = config.aws.prefix ? `${config.aws.prefix}/${prefix}`.replace(/\/+/g, '/') : prefix;

  // 获取总数
  const { totalObjects, totalFolders } = await getS3ObjectsCount(prefix);

  // 计算总页数
  const totalPages = Math.ceil(totalObjects / pageSize);

  // 收集所有对象以实现分页
  let allObjects: S3Object[] = [];
  let allFolders: S3Object[] = [];
  let continuationToken: string | undefined;
  const folderSet = new Set<string>();

  // 先获取所有文件夹
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

  // 对文件进行分页
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedObjects = allObjects.slice(startIndex, endIndex);

  return {
    objects: paginatedObjects,
    folders: allFolders, // 文件夹始终显示所有
    totalObjects,
    totalFolders,
    currentPage: page,
    totalPages,
    pageSize,
    rootPrefix: config.aws.prefix || '',
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
