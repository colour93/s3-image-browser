"use client";

import { useState, useEffect, useCallback } from 'react';
import { S3Object, S3ListResult } from '@/lib/s3';

export interface UseFilesOptions {
  prefix?: string;
  page?: number;
  pageSize?: number;
}

export interface UseFilesReturn {
  files: S3Object[];
  folders: S3Object[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  totalObjects: number;
  totalFolders: number;
  pageSize: number;
  rootPrefix: string;
  refresh: () => Promise<void>;
  selectedFiles: Set<string>;
  toggleFileSelection: (key: string) => void;
  selectAllFiles: () => void;
  clearSelection: () => void;
}

export function useFiles({ prefix = '', page = 1, pageSize = 50 }: UseFilesOptions = {}): UseFilesReturn {
  const [files, setFiles] = useState<S3Object[]>([]);
  const [folders, setFolders] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalObjects, setTotalObjects] = useState(0);
  const [totalFolders, setTotalFolders] = useState(0);
  const [rootPrefix, setRootPrefix] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        prefix,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`/s3-manage/api/files?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const result: S3ListResult = await response.json();

      setFiles(result.objects);
      setFolders(result.folders);
      setTotalPages(result.totalPages);
      setTotalObjects(result.totalObjects);
      setTotalFolders(result.totalFolders);
      setRootPrefix(result.rootPrefix);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [prefix, page, pageSize]);

  const refresh = useCallback(async () => {
    setSelectedFiles(new Set());
    await fetchFiles();
  }, [fetchFiles]);

  const toggleFileSelection = useCallback((key: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    setSelectedFiles(new Set(files.map(file => file.key)));
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    folders,
    loading,
    error,
    totalPages,
    totalObjects,
    totalFolders,
    pageSize,
    rootPrefix,
    refresh,
    selectedFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
  };
}
