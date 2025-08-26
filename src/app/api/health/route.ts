import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 简单的健康检查
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'S3 Image Browser',
      version: '1.0.0'
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { status: 500 }
    );
  }
}
