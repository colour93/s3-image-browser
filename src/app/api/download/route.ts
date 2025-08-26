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

    const url = await getSignedDownloadUrl(key);
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
