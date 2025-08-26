"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, X } from 'lucide-react';
import { S3Object } from '@/lib/s3';
import { RemoteFileMonacoEditor } from './RemoteFileMonacoEditor';

export const SUPPORTED_FILE_TYPES = ['image', 'video', 'text'];

interface FilePreviewProps {
  file: S3Object | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (file: S3Object) => void;
}

export function FilePreview({ file, isOpen, onClose, onDownload }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  React.useEffect(() => {
    if (file && isOpen && SUPPORTED_FILE_TYPES.includes(file.type)) {
      loadPreviewUrl();
    } else {
      setPreviewUrl(null);
    }
  }, [file, isOpen]);

  const loadPreviewUrl = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const response = await fetch(`/s3-manage/api/preview`, {
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
    } finally {
      setLoading(false);
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate">{file.name}</DialogTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(file)}
            >
              <Download className="w-4 h-4 mr-2" />
              下载
            </Button>
          </div>
        </DialogHeader>

        <div className="w-full flex-1 overflow-auto flex flex-col">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {file.type === 'image' && previewUrl && !loading && (
            <div className="relative overflow-hidden rounded-lg flex-1">
              <Image
                src={previewUrl}
                alt={file.name}
                fill
                style={{
                  objectFit: 'contain',
                  objectPosition: 'center',
                }}
                className="w-full h-auto object-contain"
                unoptimized
              />
            </div>
          )}

          {file.type === 'video' && previewUrl && !loading && (
            <div className="relative overflow-hidden rounded-lg flex-1">
              <video
                src={previewUrl}
                controls
                className="w-full h-auto flex-1 object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {file.type === 'text' && previewUrl && !loading && (
            <div className="relative overflow-hidden rounded-lg flex-1">
              <RemoteFileMonacoEditor url={previewUrl} />
            </div>
          )}

          {file.type === 'file' && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-lg font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-2">
                该文件类型不支持预览
              </p>
            </div>
          )}
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">文件大小:</span>
              <span className="ml-2 text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <div>
              <span className="font-medium">修改时间:</span>
              <span className="ml-2 text-muted-foreground">
                {new Date(file.lastModified).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
