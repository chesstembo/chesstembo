import { withSentryConfig } from "@sentry/nextjs";
import { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  output: phase === PHASE_PRODUCTION_BUILD ? "export" : undefined,
  trailingSlash: false,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev, isServer, buildId }) => {
    // Force production mode for all dependencies including Redux
    config.plugins = config.plugins || [];
    
    // Get the actual environment - more reliable than the 'dev' flag
    const isProduction = process.env.NODE_ENV === 'production' || phase === PHASE_PRODUCTION_BUILD;
    
    // Define environment variables for webpack - use actual NODE_ENV
    config.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.BABEL_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        // Enable Redux devtools only in development
        '__REDUX_DEVTOOLS_EXTENSION__': isProduction ? 'false' : 'true',
      })
    );

    // Set webpack mode explicitly
    config.mode = isProduction ? 'production' : 'development';

    // Optimize for production
    if (isProduction && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        usedExports: true,
        sideEffects: true, // Changed from false to true to avoid potential issues
        nodeEnv: 'production', // Explicitly set nodeEnv
      };

      // Replace development modules with production versions
      config.resolve.alias = {
        ...config.resolve.alias,
        'redux-logger': false,
      };
    }

    return config;
  },
  // Compiler options for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  headers:
    phase === PHASE_PRODUCTION_BUILD
      ? undefined
      : async () => [
          {
            source: "/",
            headers: [
              {
                key: "Cross-Origin-Embedder-Policy",
                value: "require-corp",
              },
              {
                key: "Cross-Origin-Opener-Policy",
                value: "same-origin",
              },
            ],
          },
          {
            source: "/engines/:blob*",
            headers: [
              {
                key: "Cross-Origin-Embedder-Policy",
                value: "require-corp",
              },
              {
                key: "Cross-Origin-Opener-Policy",
                value: "same-origin",
              },
              {
                key: "Cache-Control",
                value: "public, max-age=31536000, immutable",
              },
              {
                key: "Age",
                value: "181921",
              },
            ],
          },
          {
            source: "/play",
            headers: [
              {
                key: "Cross-Origin-Embedder-Policy",
                value: "require-corp",
              },
              {
                key: "Cross-Origin-Opener-Policy",
                value: "same-origin",
              },
            ],
          },
          {
            source: "/database",
            headers: [
              {
                key: "Cross-Origin-Embedder-Policy",
                value: "require-corp",
              },
              {
                key: "Cross-Origin-Opener-Policy",
                value: "same-origin",
              },
            ],
          },
          {
            source: "/train",
            headers: [
              {
                key: "Cross-Origin-Embedder-Policy",
                value: "require-corp",
              },
              {
                key: "Cross-Origin-Opener-Policy",
                value: "same-origin",
              },
            ],
          },
        ],
});

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: "javascript-nextjs",
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  hideSourceMaps: true,
  disableLogger: true,
  silent: !process.env.CI,
  dryRun: process.env.NODE_ENV !== 'production',
});