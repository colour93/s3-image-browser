'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface CacheStats {
  totalKeys: number;
  s3PageKeys: number;
  s3MetaKeys: number;
  s3LockKeys: number;
}

interface CacheResponse {
  success: boolean;
  message: string;
  data?: CacheStats | null;
  error?: string;
}

export function CacheManager() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [prefixToClear, setPrefixToClear] = useState<string>('');

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cache');
      const data: CacheResponse = await response.json();
      
      if (data.success && data.data) {
        setStats(data.data);
        showMessage('缓存统计获取成功', 'success');
      } else {
        showMessage(data.message || '获取缓存统计失败', 'error');
        setStats(null);
      }
    } catch (error) {
      showMessage('获取缓存统计失败', 'error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const clearAllCache = async () => {
    if (!confirm('确定要清除所有 S3 缓存吗？')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/cache?action=clear-all', {
        method: 'DELETE',
      });
      const data: CacheResponse = await response.json();
      
      if (data.success) {
        showMessage('清除所有缓存成功', 'success');
        await fetchStats(); // 刷新统计
      } else {
        showMessage(data.message || '清除缓存失败', 'error');
      }
    } catch (error) {
      showMessage('清除缓存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearPrefixCache = async () => {
    if (!prefixToClear.trim()) {
      showMessage('请输入要清除的 prefix', 'error');
      return;
    }

    if (!confirm(`确定要清除 prefix "${prefixToClear}" 的缓存吗？`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/cache?action=clear-prefix&prefix=${encodeURIComponent(prefixToClear)}`, {
        method: 'DELETE',
      });
      const data: CacheResponse = await response.json();
      
      if (data.success) {
        showMessage(`清除 prefix "${prefixToClear}" 的缓存成功`, 'success');
        setPrefixToClear(''); // 清空输入框
        await fetchStats(); // 刷新统计
      } else {
        showMessage(data.message || '清除缓存失败', 'error');
      }
    } catch (error) {
      showMessage('清除缓存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Redis 缓存管理</h2>
          <Button onClick={fetchStats} disabled={loading} variant="outline">
            刷新统计
          </Button>
        </div>

        {message && (
          <div className={`p-3 rounded-md text-sm ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : messageType === 'error'
              ? 'bg-red-100 text-red-800 border border-red-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {message}
          </div>
        )}

        {stats ? (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-700">总缓存键数</h3>
              <p className="text-2xl font-bold text-blue-900">{stats.totalKeys}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-700">活跃锁数量</h3>
              <p className="text-2xl font-bold text-yellow-900">{stats.s3LockKeys}</p>
            </div>
          </div>
        ) : null}

        {stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="text-sm font-medium text-green-700">分页缓存数</h3>
              <p className="text-2xl font-bold text-green-900">{stats.s3PageKeys}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="text-sm font-medium text-purple-700">元数据缓存数</h3>
              <p className="text-2xl font-bold text-purple-900">{stats.s3MetaKeys}</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
            {loading ? '加载中...' : 'Redis 缓存未启用或连接失败'}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={clearAllCache} 
              disabled={loading || !stats} 
              variant="destructive"
            >
              清除所有 S3 缓存
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">清除特定 Prefix 缓存</h3>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="输入 prefix (例如: images/2024/)"
                value={prefixToClear}
                onChange={(e) => setPrefixToClear(e.target.value)}
                disabled={loading}
                className="flex-1"
              />
              <Button 
                onClick={clearPrefixCache} 
                disabled={loading || !stats || !prefixToClear.trim()} 
                variant="outline"
              >
                清除 Prefix 缓存
              </Button>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>缓存说明：</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>缓存有效期：24小时</li>
            <li>分页缓存键：s3:page:bucket:prefix:pageIndex</li>
            <li>元数据缓存键：s3:meta:bucket:prefix</li>
            <li>锁键格式：s3:lock:bucket:prefix</li>
            <li>缓存内容：按页索引分别缓存，元数据单独缓存</li>
            <li>分页处理：直接按页索引从 Redis 获取</li>
            <li>并发控制：使用分布式锁防止缓存穿透</li>
            <li>锁超时：30秒自动释放，等待超时：10秒</li>
            <li>自动过期：缓存会在24小时后自动失效</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
