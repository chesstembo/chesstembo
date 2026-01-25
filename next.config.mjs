import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // This ensures that /privacy-policy.html stays /privacy-policy.html
  trailingSlash: false, 
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
  
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: "javascript-nextjs",
  silent: true,
  sourcemaps: {
    disable: true,
  },
});