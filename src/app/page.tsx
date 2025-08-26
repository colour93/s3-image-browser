import { FileBrowser } from '@/components/FileBrowser';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">存储桶浏览器</h1>
        </div>
        
        <FileBrowser />
      </div>
    </main>
  );
}
