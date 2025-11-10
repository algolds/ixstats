// @ts-nocheck
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

// Skip env validation in next.config.js to avoid TypeScript import issues
// The env validation will be handled by the application at runtime
// This is a common pattern when using TypeScript env files with JavaScript config files

// Import polyfill plugin
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import path from "path";

// Normalize base path so we can deploy under https://ixwiki.com/projects/ixstats
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
  experimental: {
    // Enable optimizations for heavy packages
    optimizePackageImports: [
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-select",
      "@clerk/nextjs",
    ],
    // Reduce compilation time
    esmExternals: true,
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

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack optimizations
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
        maxMemoryGenerations: Infinity,
        // Optimize serialization for large strings by using buffers
        store: "pack",
        // Use absolute path for cache directory to avoid illegal path issues
        cacheDirectory: cacheDir,
        // Remove buildDependencies to prevent ESM resolution issues during cache serialization
        buildDependencies: {
          config: [__filename],
        },
      };
    }

    // Additional polyfills for client-side only
    if (!isServer) {
      config.plugins.push(
        new NodePolyfillPlugin({
          includeAliases: ["global", "Buffer", "process"],
        })
      );
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
        ignored: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.git/**", "**/prisma/**"],
      };

      // Faster builds in development
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;
    } else {
      // Production build optimizations - keep it simple to avoid chunk loading issues
      config.optimization = {
        ...config.optimization,
        usedExports: true,
      };
    }

    return config;
  },

  // Build performance
  productionBrowserSourceMaps: false,

  // Compression (if enabled via env)
  compress: process.env.ENABLE_COMPRESSION === "true",

  // Production optimizations
  poweredByHeader: false, // Remove X-Powered-By header

  // Output standalone for Docker/production deployment
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  // It's good practice to keep your image domains defined.
  images: {
    domains: [
      "localhost",
      "lh3.googleusercontent.com",
      "upload.wikimedia.org",
      "images.unsplash.com",
      "ixwiki.com",
      "iiwiki.com",
    ],
    formats: ["image/avif", "image/webp"],
  },

  async rewrites() {
    return [
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
  },
};

export default config;
