/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  output: 'export',
  basePath: '/ppantoja/subtitleplayer',
  assetPrefix: '/ppantoja/subtitleplayer',
  trailingSlash: true
};

module.exports = nextConfig;
