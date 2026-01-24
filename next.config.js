/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // REQUIRED for Capacitor
  trailingSlash: false,      // REQUIRED for app-ads.txt, favicon, robots

  reactStrictMode: true,

  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
