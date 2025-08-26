import { Suspense } from 'react';
import { FileBrowser } from '@/components/FileBrowser';

function FileBrowserWrapper() {
  return <FileBrowser />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">存储桶浏览器</h1>
        </div>
        
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">加载中...</p>
            </div>
          </div>
        }>
          <FileBrowserWrapper />
        </Suspense>
      </div>
    </main>
  );
}
