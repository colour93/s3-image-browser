/** @type {import('next').NextConfig} */
const nextConfig = {
  // 支持子路径部署，可以通过环境变量配置
  basePath: '/s3-manage',

  // 确保静态资源路径正确
  assetPrefix: '/s3-manage',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 配置重写规则，处理子路径下的API路由
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig
