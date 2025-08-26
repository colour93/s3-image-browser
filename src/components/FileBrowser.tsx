"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFiles } from '@/hooks/useFiles';
import { S3Object } from '@/lib/s3';
import { MasonryView } from './MasonryView';
import { ListView } from './ListView';
import { FilePreview } from './FilePreview';
import { PathBar } from './PathBar';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Grid,
  List,
  Download,
  RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';

interface FileBrowserProps {
  initialPrefix?: string;
}

export function FileBrowser({ initialPrefix = '' }: FileBrowserProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 从 URL 参数中获取初始状态
  const urlPath = searchParams.get('path') || initialPrefix;
  const urlPage = parseInt(searchParams.get('page') || '1');
  const urlView = (searchParams.get('view') as 'grid' | 'list') || 'list';

  const [currentPrefix, setCurrentPrefix] = useState(urlPath);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(urlView);
  const [previewFile, setPreviewFile] = useState<S3Object | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    files,
    folders,
    loading,
    error,
    totalPages,
    totalObjects,
    totalFolders,
    pageSize,
    rootPrefix,
    refresh: refreshFiles,
    selectedFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
  } = useFiles({
    prefix: currentPrefix ? currentPrefix + '/' : '',
    page: currentPage,
    pageSize: 50
  });

  // 更新 URL 参数
  const updateURL = useCallback((path?: string, page?: number, view?: string) => {
    const params = new URLSearchParams();

    if (path !== undefined && path !== '') {
      params.set('path', path);
    }
    if (page !== undefined && page !== 1) {
      params.set('page', page.toString());
    }
    if (view !== undefined && view !== 'list') {
      params.set('view', view);
    }

    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(newURL, { scroll: false });
  }, [router]);

  // 监听状态变化并更新 URL
  useEffect(() => {
    // 避免在初始化时立即更新 URL
    const urlPath = searchParams.get('path') || '';
    const urlPage = parseInt(searchParams.get('page') || '1');
    const urlView = (searchParams.get('view') as 'grid' | 'list') || 'list';

    // 只有当状态真正改变时才更新 URL
    if (currentPrefix !== urlPath || currentPage !== urlPage || viewMode !== urlView) {
      updateURL(currentPrefix, currentPage, viewMode);
    }
  }, [currentPrefix, currentPage, viewMode, updateURL, searchParams]);

  const handleFolderClick = useCallback((folder: S3Object) => {
    // 处理文件夹导航，需要从完整路径中提取相对路径
    let newPrefix = folder.key;

    // 移除根前缀部分
    if (rootPrefix) {
      const rootPrefixWithSlash = rootPrefix.endsWith('/') ? rootPrefix : `${rootPrefix}/`;
      if (newPrefix.startsWith(rootPrefixWithSlash)) {
        newPrefix = newPrefix.substring(rootPrefixWithSlash.length);
      }
    }

    // 确保文件夹路径以 / 结尾，但不要重复添加
    if (!newPrefix.endsWith('/')) {
      newPrefix += '/';
    }

    // 移除开头的 /
    newPrefix = newPrefix.replace(/^\/+/, '');

    // 移除结尾的 /
    newPrefix = newPrefix.replace(/\/+$/, '');

    setCurrentPrefix(newPrefix);
    setCurrentPage(1); // 重置到第一页
    clearSelection();
  }, [clearSelection, rootPrefix]);

  const handlePathChange = useCallback((path: string) => {
    // 处理路径变更，支持直接输入路径
    const cleanPath = path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    setCurrentPrefix(cleanPath);
    setCurrentPage(1); // 重置到第一页
    clearSelection();
  }, [clearSelection]);

  const handleNavigateUp = useCallback(() => {
    // 返回上级目录
    if (!currentPrefix) return;

    const parts = currentPrefix.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const newPrefix = parts.join('/');
      setCurrentPrefix(newPrefix);
      setCurrentPage(1); // 重置到第一页
      clearSelection();
    }
  }, [currentPrefix, clearSelection]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
    }
  }, [currentPage, totalPages]);

  const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
  }, []);

  const refresh = useCallback(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handlePreview = useCallback((file: S3Object) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
  }, []);

  const handleDownload = useCallback(async (file: S3Object) => {
    try {
      const response = await fetch(`/s3-manage/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: file.key }),
      });

      if (response.ok) {
        const { url } = await response.json();
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, []);

  const handleBatchDownload = useCallback(async () => {
    const selectedFileObjects = files.filter(file => selectedFiles.has(file.key));

    for (const file of selectedFileObjects) {
      await handleDownload(file);
      // 添加延迟避免同时下载太多文件
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, [files, selectedFiles, handleDownload]);

  const toggleSelectAll = useCallback(() => {
    if (selectedFiles.size === files.length) {
      clearSelection();
    } else {
      selectAllFiles();
    }
  }, [selectedFiles.size, files.length, clearSelection, selectAllFiles]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <div className="text-4xl mb-4">❌</div>
          <p className="text-lg font-medium text-destructive">加载失败</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    const commonProps = {
      files,
      folders,
      selectedFiles,
      onSelect: toggleFileSelection,
      onPreview: handlePreview,
      onFolderClick: handleFolderClick,
      onDownload: handleDownload,
      currentPage,
      totalPages,
      totalObjects,
      totalFolders,
      loading,
      onPageChange: handlePageChange,
    };

    switch (viewMode) {
      case 'list':
        return <ListView {...commonProps} />;
      case 'grid':
      default:
        return <MasonryView {...commonProps} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* 路径导航栏 */}
        <PathBar
          currentPath={currentPrefix}
          rootPrefix={rootPrefix}
          onPathChange={handlePathChange}
          onNavigateUp={handleNavigateUp}
          className="flex-1 min-w-0"
        />

        {/* 工具按钮 */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* 全选/取消全选 */}
          {files.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedFiles.size === files.length ? (
                <CheckSquare className="w-4 h-4 mr-2" />
              ) : (
                <Square className="w-4 h-4 mr-2" />
              )}
              {selectedFiles.size === files.length ? '取消全选' : '全选'}
            </Button>
          )}

          {/* 批量下载 */}
          {selectedFiles.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              下载选中 ({selectedFiles.size})
            </Button>
          )}

          {/* 视图切换 */}
          <Select value={viewMode} onValueChange={handleViewModeChange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">
                <div className="flex items-center">
                  <Grid className="w-4 h-4 mr-2" />
                  网格
                </div>
              </SelectItem>
              <SelectItem value="list">
                <div className="flex items-center">
                  <List className="w-4 h-4 mr-2" />
                  列表
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 文件显示区域 */}
      <div className="min-h-[400px]">
        {renderView()}
      </div>

      {/* 文件预览弹窗 */}
      <FilePreview
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        onDownload={handleDownload}
      />
    </div>
  );
}
