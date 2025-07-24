// @ts-nocheck
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

// Define basePath from an environment variable to allow for dynamic deployment paths.
// It defaults to an empty string, which works for local development or root deployments.
const basePath = process.env.BASE_PATH || '';

/** @type {import("next").NextConfig} */
const config = {
  // Use the dynamic basePath.
  basePath: basePath,

  // When using basePath, assetPrefix is not usually needed.
  // Next.js automatically prefixes assets (like images, CSS) with the basePath.
  // The assetPrefix key has been removed to avoid potential conflicts.

  trailingSlash: false,
  reactStrictMode: true,

  // App Router is now stable in Next.js 13+, no experimental flag needed

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // It's good practice to keep your image domains defined.
  images: {
    domains: ['localhost', 'lh3.googleusercontent.com', 'upload.wikimedia.org'],
  },
};

export default config;
