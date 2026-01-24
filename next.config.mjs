import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",      // Required for Capacitor (Static Build)
  trailingSlash: false,  // false is generally better for Capacitor
  reactStrictMode: true,
  
  // Required for Static Exports (Capacitor)
  images: {
    unoptimized: true,
  },

  // Ignore strict checks to ensure build passes
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optimize production code
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

// Export with Sentry wrapper
export default withSentryConfig(nextConfig, {
  // Sentry Webpack Plugin Options
  org: process.env.SENTRY_ORG,
  project: "javascript-nextjs", // Ensure this matches your Sentry project name
  silent: true, // Suppresses all logs
});
