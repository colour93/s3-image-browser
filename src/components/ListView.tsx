"use client";

import React from 'react';
import { S3Object } from '@/lib/s3';
import { FileItem } from './FileItem';
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from './ui/pagination';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Files, FolderIcon } from 'lucide-react';

interface ListViewProps {
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

export function ListView({ 
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
}: ListViewProps) {
  const allItems = [...folders, ...files];

  // 生成分页按钮
  const generatePaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // 如果总页数少于等于最大显示数，显示所有页面
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
      // 复杂分页逻辑
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

  if (allItems.length === 0 && !loading) {
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

      {/* 文件列表 */}
      <div className="space-y-2">
        {/* 文件夹 */}
        {folders.map((folder) => (
          <FileItem
            key={folder.key}
            item={folder}
            showCheckbox={false}
            onClick={onFolderClick}
          />
        ))}

        {/* 文件 */}
        {files.map((file) => (
          <FileItem
            key={file.key}
            item={file}
            isSelected={selectedFiles.has(file.key)}
            onSelect={onSelect}
            onPreview={onPreview}
            onDownload={onDownload}
            showCheckbox={true}
            showThumbnail={true}
          />
        ))}
      </div>

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
