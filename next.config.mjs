import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: false,
  reactStrictMode: true,
  
  images: {
    unoptimized: true,
  },

  typescript: {
    // Skips type checking during the build
    ignoreBuildErrors: true,
  },

  eslint: {
    // Skips linting during the build
    ignoreDuringBuilds: true,
  },
  
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: "javascript-nextjs",
  silent: true,
});