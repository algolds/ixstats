/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  experimental: {
    // Enable React 18 optimizations
    reactCompiler: true,
    // Optimize bundle
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "lucide-react",
      "@chakra-ui/react",
      "@emotion/react",
    ],
  },

  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 86400, // 24 hours (increased from 60 seconds)
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Allow Wikimedia Commons images
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
        pathname: "/**",
      },
    ],
    // Use custom loader for Wikimedia images
    loader: process.env.NODE_ENV === "production" ? "custom" : "default",
    loaderFile: "./src/lib/wikimedia-image-loader.ts",
  },

  // Bundle optimization
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Optimize chunks
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          common: {
            name: "common",
            minChunks: 2,
            chunks: "all",
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }

    // Memory optimization
    config.optimization.moduleIds = "deterministic";
    config.optimization.chunkIds = "deterministic";

    return config;
  },

  // Headers for production
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=600",
          },
        ],
      },
      {
        source: "/api/equipment-images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=31536000, immutable", // 30 days client, 1 year CDN
          },
          {
            key: "CDN-Cache-Control",
            value: "max-age=31536000", // 1 year CDN cache
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 1 year for Next.js optimized images
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Output configuration
  output: "standalone",

  // Enable compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // Strict mode
  reactStrictMode: true,

  // SWC minification
  swcMinify: true,

  // Trailing slash
  trailingSlash: false,

  // Base path (if needed)
  // basePath: '/projects/ixstats',

  // Asset prefix (if needed)
  // assetPrefix: '/projects/ixstats',
};

module.exports = nextConfig;
