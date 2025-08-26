import * as path from 'path';

export interface AppConfig {
  aws: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    prefix?: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    enabled: boolean;
  };
  app: {
    pageSize: number;
    maxFileSize: string;
    supportedImageFormats: string[];
    supportedVideoFormats: string[];
    downloadChunkSize: string;
  };
}

// 服务器端配置加载函数
export async function getServerConfig(): Promise<AppConfig> {
  if (typeof window !== 'undefined') {
    throw new Error('getServerConfig can only be called on the server side');
  }
  
  const yaml = await import('js-yaml');
  const fs = await import('fs');
  
  try {
    const configPath = path.join(process.cwd(), 'config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    return yaml.load(fileContents) as AppConfig;
  } catch (error) {
    console.error('Failed to load config:', error);
    throw new Error('Configuration file not found or invalid');
  }
}
