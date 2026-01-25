import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use 'export' for a fully static site (required for Capacitor)
  output: "export",
  
  // ensures /privacy-policy.html stays exactly as /privacy-policy.html 
  // and doesn't get turned into /privacy-policy/index.html
  trailingSlash: false, 
  
  reactStrictMode: true,
  
  // Required for static export to work with the Image component
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

  // This helps ensure the public directory is cleanly mapped
  cleanDistDir: true,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: "javascript-nextjs",
  silent: true,
  sourcemaps: {
    // Disabling sourcemaps speeds up the build and prevents upload errors
    disable: true,
  },
});
