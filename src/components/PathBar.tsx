"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Home, 
  ChevronRight, 
  Edit3, 
  Check, 
  X, 
  Copy,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PathBarProps {
  currentPath: string;
  rootPrefix: string;
  onPathChange: (path: string) => void;
  onNavigateUp: () => void;
  className?: string;
}

interface BreadcrumbItem {
  name: string;
  path: string;
  isLast: boolean;
}

export function PathBar({ currentPath, rootPrefix, onPathChange, onNavigateUp, className }: PathBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPath, setEditPath] = useState(currentPath);
  const inputRef = useRef<HTMLInputElement>(null);

  // 生成面包屑项目
  const breadcrumbs: BreadcrumbItem[] = React.useMemo(() => {
    if (!currentPath) return [];
    
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/'),
      isLast: index === parts.length - 1
    }));
  }, [currentPath]);

  // 处理编辑模式
  const handleStartEdit = () => {
    setEditPath(currentPath);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditPath(currentPath);
    setIsEditing(false);
  };

  const handleConfirmEdit = () => {
    const cleanPath = editPath.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    onPathChange(cleanPath);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // 复制路径到剪贴板
  const handleCopyPath = async () => {
    try {
      const fullPath = rootPrefix ? `${rootPrefix}/${currentPath}`.replace(/\/+/g, '/') : currentPath || '/';
      await navigator.clipboard.writeText(fullPath);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  // 自动聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div className={cn("flex items-center space-x-2 min-w-0 flex-1", className)}>
      {/* 返回上级按钮 */}
      {currentPath && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateUp}
          className="flex-shrink-0"
          title="返回上级目录"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}

      {/* 主目录按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPathChange('')}
        className={cn(
          "flex-shrink-0",
          !currentPath && "bg-accent"
        )}
        title="返回根目录"
      >
        <Home className="w-4 h-4" />
      </Button>

      {/* 路径显示/编辑区域 */}
      <div className="flex items-center min-w-0 flex-1">
        {isEditing ? (
          // 编辑模式
          <div className="flex items-center space-x-2 flex-1">
            <div className="flex items-center space-x-1 text-sm text-muted-foreground flex-shrink-0">
              <FolderOpen className="w-4 h-4" />
              <span>/</span>
            </div>
            <Input
              ref={inputRef}
              value={editPath}
              onChange={(e) => setEditPath(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 h-8 text-sm"
              placeholder="输入文件夹路径..."
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConfirmEdit}
              className="flex-shrink-0 h-8 w-8 p-0"
            >
              <Check className="w-4 h-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              className="flex-shrink-0 h-8 w-8 p-0"
            >
              <X className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        ) : (
          // 显示模式
          <div className="flex items-center min-w-0 flex-1">
            {/* 面包屑导航 */}
            <div className="flex items-center space-x-1 min-w-0 flex-1">
              {breadcrumbs.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  {rootPrefix ? `根目录 (${rootPrefix})` : '根目录'}
                </span>
              ) : (
                breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.path}>
                    {index > 0 && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPathChange(crumb.path)}
                      className={cn(
                        "text-sm px-2 py-1 h-auto min-w-0 truncate",
                        crumb.isLast && "bg-accent font-medium"
                      )}
                      title={crumb.name}
                    >
                      {crumb.name}
                    </Button>
                  </React.Fragment>
                ))
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyPath}
                className="h-8 w-8 p-0"
                title="复制路径"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="h-8 w-8 p-0"
                title="编辑路径"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
