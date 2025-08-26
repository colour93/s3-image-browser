import { NextRequest, NextResponse } from 'next/server';
import { listS3Objects } from '@/lib/s3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const page = searchParams.get('page');

    let result;

    if (page) {
      // 使用页码分页
      result = await listS3Objects(prefix, parseInt(page), pageSize);
    } else {
      // 默认第一页
      result = await listS3Objects(prefix, 1, pageSize);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
