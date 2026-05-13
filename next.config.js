// @ts-nocheck
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

// Skip env validation in next.config.js to avoid TypeScript import issues
// The env validation will be handled by the application at runtime
// This is a common pattern when using TypeScript env files with JavaScript config files

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

// Normalize base path so we can deploy under https://ixwiki.com/projects/ixstates
const normalizeBasePath = (value) => {
  if (!value) {
    return "";
  }
  let normalized = value.startsWith("/") ? value : `/${value}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

const resolveBasePath = () => {
  // If explicitly building for IxWorld standalone (maps.ixwiki.com), ALWAYS use empty base path
  if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
    return "";
  }

  const hasBasePathEnv = Object.prototype.hasOwnProperty.call(process.env, "BASE_PATH");
  const rawBasePath = hasBasePathEnv
    ? process.env.BASE_PATH
    : process.env.NODE_ENV === "production"
      ? "/projects/ixstats"
      : "";
  return normalizeBasePath(rawBasePath);
};

const basePath = resolveBasePath();
const assetPrefix = basePath || undefined;

/** @type {import("next").NextConfig} */
const config = {
  // Use the dynamic basePath.
  basePath: basePath,
  assetPrefix,

  trailingSlash: false,
  reactStrictMode: true,

  // Performance optimizations
  // Prevent webpack from bundling heavy server-only packages (loaded via require at runtime)
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@node-rs/argon2",
    "sharp",
  ],

  experimental: {
    // Enable optimizations for heavy packages (tree-shakes unused exports)
    optimizePackageImports: [
      "lucide-react",          // 45MB, 3824 icons - only ~200 used
      "recharts",              // 8MB charting library
      "react-icons/ri",        // 2500+ Remix Icons barrel
      "react-icons/fa",        // FontAwesome barrel
      "react-icons/fa6",       // FontAwesome 6 barrel
      "react-icons/gi",        // Game Icons barrel
      "framer-motion",
      "motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@clerk/nextjs",
    ],
    // Reduce compilation time
    esmExternals: true,
    // Note: instrumentationHook removed - Next.js 16 loads instrumentation.ts automatically
  },

  // Build performance improvements
  modularizeImports: {
    "@radix-ui/react-icons": {
      transform: "@radix-ui/react-icons/dist/{{member}}",
    },
    // Recharts uses standard imports, no transform needed
  },

  // TypeScript performance
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "./tsconfig.json",
  },

  // Turbopack configuration (default in Next.js 16)
  // Empty config acknowledges Turbopack usage while keeping webpack as fallback
  turbopack: {},

  // Webpack optimizations (used as fallback when --webpack flag is passed)
  webpack: (config, { dev, isServer, webpack }) => {
    // Fix for 'self is not defined' error - set globalObject to 'this'
    // This is the most reliable solution according to webpack documentation
    config.output.globalObject = "this";

    // Fix webpack cache warning - optimize serialization for large strings
    if (config.cache && dev) {
      // Ensure cache directory exists and is properly configured
      const cacheDir = path.resolve(process.cwd(), ".next/cache");

      config.cache = {
        ...config.cache,
        type: "filesystem",
        compression: "gzip",
        // Keep only 1 generation in memory (current), evict older ones to disk.
        // Infinity keeps ALL compiled modules in RAM indefinitely → memory leak.
        maxMemoryGenerations: 1,
        store: "pack",
        cacheDirectory: cacheDir,
        buildDependencies: {
          config: [__filename],
        },
      };
    }

    // Server-side: externalize socket.io packages and prevent bundling
    if (isServer) {
      // Add to externals
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);

      config.externals = [
        ...externals,
        ({ request }, callback) => {
          // Externalize all socket.io related packages
          if (
            request === "socket.io" ||
            request === "socket.io-client" ||
            request?.startsWith("socket.io/") ||
            request?.startsWith("socket.io-client/") ||
            request === "engine.io" ||
            request === "engine.io-client" ||
            request === "ws"
          ) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }

    // Client-side: exclude server-only packages from bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "socket.io": false,
        "socket.io-client": false,
        http: false,
        https: false,
        net: false,
        tls: false,
        fs: false,
      };
    }

    // Development optimizations - reduce compilation time
    if (dev) {
      config.watchOptions = {
        poll: false,
        ignored: [
          "**/node_modules/**",
          "**/.next/**",
          "**/dist/**",
          "**/.git/**",
          "**/prisma/**",
          "**/docs/**",
          "**/scripts/**",
          "**/public/flags/**",
          "**/*.md",
        ],
      };

      // Faster builds in development
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;

      // Reduce memory pressure in dev — faster ID algorithms + less stats overhead
      config.optimization.moduleIds = 'named';
      config.optimization.chunkIds = 'named';
      config.stats = 'errors-warnings';
      config.infrastructureLogging = { level: 'warn' };
    } else {
      // Production build optimizations
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        // Split chunks to separate heavy vendor libraries
        // This reduces initial bundle size and improves caching
        splitChunks: {
          chunks: "all",
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            // Separate recharts (heavy charting library)
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: "recharts",
              chunks: "all",
              priority: 30,
            },
            // Separate Radix UI components
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: "radix",
              chunks: "all",
              priority: 30,
            },
            // Separate framer-motion (animation library)
            framer: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: "framer",
              chunks: "all",
              priority: 30,
            },
            // Separate maplibre-gl (map rendering engine)
            maplibre: {
              test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/,
              name: "maplibre",
              chunks: "all",
              priority: 30,
            },
            // Group remaining vendor modules
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },

  // Build performance
  productionBrowserSourceMaps: false,

  // Compression enabled by default in production (60-70% payload reduction)
  compress: process.env.NODE_ENV === "production",

  // Production optimizations
  poweredByHeader: false, // Remove X-Powered-By header

  // Output standalone for Docker/production deployment
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  // It's good practice to keep your image domains defined.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "ixwiki.com",
      },
      {
        protocol: "https",
        hostname: "iiwiki.com",
      },
      // Note: NationStates images are now proxied through /api/proxy-ns-image
      // to bypass hotlinking restrictions, so no NS domains needed here
    ],
    // Allow local API routes with query strings (for NS image proxy and placeholders)
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Handle external image errors gracefully
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async rewrites() {
    const baseRewrites = [
      {
        source: "/api/ixwiki-proxy/:path*",
        destination: "https://ixwiki.com/:path*",
      },
      {
        source: "/api/iiwiki-proxy/:path*",
        destination: "https://iiwiki.com/:path*",
      },
      {
        source: "/api/althistory-wiki-proxy/:path*",
        destination: "https://althistory.fandom.com/:path*",
      },
    ];

    if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
      return {
        beforeFiles: [
          {
            // Map root-level slugs to countries/[slug] for standalone mode
            // Exclude reserved top-level paths
            source: "/:slug((?!maps|api|profile|sign-in|sign-up|flags|_next|favicon.ico|placeholder|messages).*)",
            destination: "/countries/:slug",
          },
        ],
        fallback: baseRewrites,
      };
    }

    return baseRewrites;
  },

  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=86400", // Cache for 1 day
          },
        ],
      },
      {
        source: "/api/trpc/geo.:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default config;
