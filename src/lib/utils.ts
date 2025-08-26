import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as path from 'path';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 客户端可用的文件工具函数
export function isImageFile(filename: string): boolean {
  const supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const ext = path.extname(filename).toLowerCase().slice(1);
  return supportedImageFormats.includes(ext);
}

export function isVideoFile(filename: string): boolean {
  const supportedVideoFormats = ['mp4', 'webm', 'mov', 'avi'];
  const ext = path.extname(filename).toLowerCase().slice(1);
  return supportedVideoFormats.includes(ext);
}

export function isTextFile(filename: string): boolean {
  const supportedTextFormats = ['txt', 'text', 'log', 'json', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'config', 'properties', 'props', 'ini', 'conf', 'cfg', 'config', 'properties', 'props'];
  const ext = path.extname(filename).toLowerCase().slice(1);
  return supportedTextFormats.includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
