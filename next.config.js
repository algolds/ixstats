/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Use basePath only in production
  basePath: process.env.NODE_ENV === "production" ? "/projects/ixstats" : "",
  assetPrefix: process.env.NODE_ENV === "production" ? "/projects/ixstats" : "",
  trailingSlash: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default config;
