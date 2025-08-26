import { NextRequest, NextResponse } from 'next/server';
import { getSignedDownloadUrl } from '@/lib/s3';

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    
    if (!key) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    // 为预览生成较短期限的签名URL（15分钟）
    const url = await getSignedDownloadUrl(key, 900);
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating preview URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview URL' },
      { status: 500 }
    );
  }
}
