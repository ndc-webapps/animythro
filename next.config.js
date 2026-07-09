// next.config.js
/** @type {import('next').NextConfig} */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  ...(isCapacitorBuild
    ? {
        output: 'export',
        images: {
          unoptimized: true,
        },
      }
    : {}),
  // Proxy StatsPilot tracking through our own domain so the calls are same-origin —
  // privacy browsers (Brave Shields, etc.) block third-party requests to
  // statspilot.vercel.app regardless of how the script/endpoint paths are named.
  ...(isCapacitorBuild
    ? {}
    : {
        async rewrites() {
          return [
            { source: '/static/insights.js', destination: 'https://statspilot.vercel.app/script.js' },
            { source: '/api/collect', destination: 'https://statspilot.vercel.app/api/collect' },
          ];
        },
        images: {
          remotePatterns: [
            {
              protocol: 'https',
              hostname: 'images.unsplash.com',
            },
            {
              protocol: 'https',
              hostname: 'i.ytimg.com',
            },
            {
              protocol: 'https',
              hostname: 'img.anili.st',
            },
            {
              protocol: 'https',
              hostname: 's4.anilist.co',
            },
          ],
        },
      }),
};

module.exports = nextConfig;
