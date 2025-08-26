"use client";

import React, { useState, useEffect } from 'react';
import { S3Object } from '@/lib/s3';
import { formatFileSize } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';
import { FileIcon, FolderIcon, ImageIcon, VideoIcon, Download, Eye, FileTextIcon } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { SUPPORTED_FILE_TYPES } from './FilePreview';

interface FileItemProps {
  item: S3Object;
  isSelected?: boolean;
  onSelect?: (key: string) => void;
  onClick?: (item: S3Object) => void;
  onDoubleClick?: (item: S3Object) => void;
  onDownload?: (item: S3Object) => void;
  onPreview?: (item: S3Object) => void;
  showCheckbox?: boolean;
  showThumbnail?: boolean;
}

export function FileItem({
  item,
  isSelected = false,
  onSelect,
  onClick,
  onDoubleClick,
  onDownload,
  onPreview,
  showCheckbox = true,
  showThumbnail = false
}: FileItemProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  // 懒加载缩略图
  useEffect(() => {
    if (showThumbnail && item.type === 'image' && !thumbnailUrl && !thumbnailError) {
      loadThumbnail();
    }
  }, [showThumbnail, item, thumbnailUrl, thumbnailError]);

  const loadThumbnail = async () => {
    if (thumbnailLoading) return;

    setThumbnailLoading(true);
    try {
      const response = await fetch(`/s3-manage/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: item.key }),
      });

      if (response.ok) {
        const { url } = await response.json();
        setThumbnailUrl(url);
      } else {
        setThumbnailError(true);
      }
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
      setThumbnailError(true);
    } finally {
      setThumbnailLoading(false);
    }
  };

  const getIcon = () => {
    if (item.isFolder) {
      return <FolderIcon className="size-6 text-blue-500" />;
    }

    switch (item.type) {
      case 'image':
        return <ImageIcon className="size-6 text-green-500" />;
      case 'video':
        return <VideoIcon className="size-6 text-purple-500" />;
      case 'text':
        return <FileTextIcon className="size-6 text-gray-500" />;
      default:
        return <FileIcon className="size-6 text-gray-500" />;
    }
  };

  const handleClick = () => {
    if (item.isFolder && onClick) {
      onClick(item);
    } else if (SUPPORTED_FILE_TYPES.includes(item.type) && onPreview) {
      onPreview(item);
    }
  };

  const handleDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(item);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(item);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview(item);
    }
  };

  const FileContent = (
    <div
      className={`
        flex items-center space-x-3 p-2 rounded-lg border cursor-pointer group
        transition-colors duration-200 hover:bg-accent
        ${isSelected ? 'bg-accent border-primary' : 'bg-card'}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {showCheckbox && !item.isFolder && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.(item.key)}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        />
      )}

      <div className="flex-shrink-0">
        {showThumbnail && item.type === 'image' ? (
          <div className="w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center">
            {thumbnailLoading ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
            ) : thumbnailUrl && !thumbnailError ? (
              <img
                src={thumbnailUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={() => setThumbnailError(true)}
              />
            ) : (
              getIcon()
            )}
          </div>
        ) : (
          getIcon()
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {!item.isFolder && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>{formatFileSize(item.size)} | {new Date(item.lastModified).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {!item.isFolder && (
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {SUPPORTED_FILE_TYPES.includes(item.type) && onPreview && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePreviewClick}
              title="预览"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleDownloadClick}
              title="下载"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (item.isFolder) {
    return FileContent;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {FileContent}
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.name}</p>
            </div>
          </div>

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">大小:</span>
              <span>{formatFileSize(item.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">类型:</span>
              <span className="capitalize">{item.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">修改时间:</span>
              <span>
                {new Date(item.lastModified).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
