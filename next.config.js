/** @type {import('next').NextConfig} */
const nextConfig = {
  // 支持子路径部署，可以通过环境变量配置
  basePath: process.env.BASE_PATH || '',

  // 确保静态资源路径正确
  assetPrefix: process.env.BASE_PATH || '',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  output: 'standalone',

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
