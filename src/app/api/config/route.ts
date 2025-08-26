import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = await getServerConfig();
    
    // 只返回客户端需要的配置，不暴露敏感信息
    return NextResponse.json({
      app: {
        pageSize: config.app.pageSize,
        supportedImageFormats: config.app.supportedImageFormats,
        supportedVideoFormats: config.app.supportedVideoFormats,
      }
    });
  } catch (error) {
    console.error('Error loading config:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}
