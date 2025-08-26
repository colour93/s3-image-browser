import { NextRequest, NextResponse } from 'next/server';
import { clearS3Cache, getCacheStats, clearPrefixCache } from '@/lib/redis';
import { getServerConfig } from '@/lib/config';

// GET /api/cache - 获取缓存统计信息
export async function GET() {
  try {
    const stats = await getCacheStats();
    
    if (!stats) {
      return NextResponse.json({
        success: false,
        message: 'Redis 缓存未启用或连接失败',
        data: null
      });
    }

    return NextResponse.json({
      success: true,
      message: '获取缓存统计成功',
      data: stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json({
      success: false,
      message: '获取缓存统计失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/cache - 清除缓存
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const prefix = url.searchParams.get('prefix');

    if (action === 'clear-all') {
      // 清除所有 S3 缓存
      const success = await clearS3Cache();
      
      return NextResponse.json({
        success,
        message: success ? '清除所有 S3 缓存成功' : '清除缓存失败'
      });
    } else if (action === 'clear-prefix' && prefix !== null) {
      // 清除特定 prefix 的所有缓存项（包括所有分页和元数据）
      const config = await getServerConfig();
      const success = await clearPrefixCache(config.aws.bucket, prefix);
      
      return NextResponse.json({
        success,
        message: success ? `清除 prefix "${prefix}" 的所有缓存成功` : '清除缓存失败',
        prefix
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '无效的操作参数。支持的操作：clear-all 或 clear-prefix（需要 prefix 参数）'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json({
      success: false,
      message: '清除缓存失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
