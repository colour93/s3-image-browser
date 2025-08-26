"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Masonry } from 'masonic';
import { S3Object } from '@/lib/s3';
import { formatFileSize } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileIcon, ImageIcon, VideoIcon, Files, FolderIcon } from 'lucide-react';
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from './ui/pagination';

interface MasonryItemProps {
  index: number;
  data: S3Object;
  width: number;
}

interface MasonryViewProps {
  files: S3Object[];
  folders: S3Object[];
  selectedFiles: Set<string>;
  onSelect: (key: string) => void;
  onPreview: (file: S3Object) => void;
  onFolderClick: (folder: S3Object) => void;
  onDownload: (file: S3Object) => void;
  currentPage: number;
  totalPages: number;
  totalObjects: number;
  totalFolders: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

const MasonryItem = React.memo(({ data: file, width }: MasonryItemProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (file.type === 'image') {
      loadPreviewUrl();
    }
  }, [file]);

  const loadPreviewUrl = async () => {
    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: file.key }),
      });

      if (response.ok) {
        const { url } = await response.json();
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      setImageError(true);
    }
  };

  const getIcon = () => {
    switch (file.type) {
      case 'image':
        return <ImageIcon className="w-12 h-12 text-green-500" />;
      case 'video':
        return <VideoIcon className="w-12 h-12 text-purple-500" />;
      default:
        return <FileIcon className="w-12 h-12 text-gray-500" />;
    }
  };

  const itemHeight = file.type === 'image' && !imageError ? 
    Math.max(200, Math.min(400, width * 0.75)) : 200;

  return (
    <div 
      className="bg-card rounded-lg border shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
      style={{ width, height: itemHeight }}
    >
      <div className="relative h-full">
        {file.type === 'image' && previewUrl && !imageError ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-muted">
            {getIcon()}
          </div>
        )}

        {/* 覆盖层 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
        
        {/* 文件信息覆盖层 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs opacity-90">{formatFileSize(file.size)}</p>
        </div>
      </div>
    </div>
  );
});

MasonryItem.displayName = 'MasonryItem';

export function MasonryView({ 
  files, 
  folders, 
  selectedFiles, 
  onSelect, 
  onPreview, 
  onFolderClick,
  onDownload,
  currentPage,
  totalPages,
  totalObjects,
  totalFolders,
  loading,
  onPageChange
}: MasonryViewProps) {
  const imageFiles = useMemo(() => 
    files.filter(file => !file.isFolder), 
    [files]
  );

  const handleItemClick = useCallback((file: S3Object) => {
    onPreview(file);
  }, [onPreview]);

  // 生成分页按钮
  const generatePaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => onPageChange(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                isActive={currentPage === i}
                onClick={() => onPageChange(i)}
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink onClick={() => onPageChange(totalPages)}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (currentPage >= totalPages - 2) {
        items.push(
          <PaginationItem key={1}>
            <PaginationLink onClick={() => onPageChange(1)}>
              1
            </PaginationLink>
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        for (let i = totalPages - 3; i <= totalPages; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                isActive={currentPage === i}
                onClick={() => onPageChange(i)}
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
      } else {
        items.push(
          <PaginationItem key={1}>
            <PaginationLink onClick={() => onPageChange(1)}>
              1
            </PaginationLink>
          </PaginationItem>
        );
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                isActive={currentPage === i}
                onClick={() => onPageChange(i)}
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink onClick={() => onPageChange(totalPages)}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }
    
    return items;
  };

  if (imageFiles.length === 0 && folders.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <div className="text-4xl mb-4">📁</div>
          <p className="text-lg font-medium">该目录为空</p>
          <p className="text-sm text-muted-foreground">没有找到文件或文件夹</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">目录统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <FolderIcon className="w-4 h-4 mr-1 text-blue-500" />
                {totalFolders} 个文件夹
              </span>
              <span className="flex items-center">
                <Files className="w-4 h-4 mr-1 text-green-500" />
                {totalObjects} 个文件
              </span>
            </div>
            {totalPages > 1 && (
              <span className="text-muted-foreground">
                第 {currentPage} 页，共 {totalPages} 页
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文件夹 */}
      {folders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">文件夹</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <div
                  key={folder.key}
                  onClick={() => onFolderClick(folder)}
                  className="flex flex-col items-center p-4 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                >
                  <FolderIcon className="w-12 h-12 text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-center truncate w-full">{folder.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 瀑布流文件展示 */}
      {imageFiles.length > 0 && (
        <div className="w-full">
          <Masonry
            items={imageFiles}
            columnGutter={16}
            columnWidth={250}
            overscanBy={5}
            render={({ index, data, width }) => (
              <div 
                key={data.key}
                onClick={() => handleItemClick(data)}
              >
                <MasonryItem 
                  index={index} 
                  data={data} 
                  width={width} 
                />
              </div>
            )}
          />
        </div>
      )}

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              
              {generatePaginationItems()}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {loading && (
        <div className="flex justify-center pt-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
