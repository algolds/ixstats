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
      "@clerk/nextjs"
    ],
    // Reduce compilation time
    esmExternals: true,
  },

  // Build performance improvements
  modularizeImports: {
    '@radix-ui/react-icons': {
      transform: '@radix-ui/react-icons/dist/{{member}}',
    },
    // Recharts uses standard imports, no transform needed
  },

  // TypeScript performance
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: './tsconfig.json',
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Development optimizations - reduce compilation time
    if (dev) {
      config.watchOptions = {
        poll: false,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/dist/**',
          '**/.git/**',
          '**/prisma/**',
        ],
      };
      
      // Faster builds in development
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;
    } else {
      // Production build optimizations
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        // Better chunk splitting for large apps
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              maxSize: 244000, // ~244kb chunks
            },
            common: {
              minChunks: 2,
              chunks: 'all',
              enforce: true,
              maxSize: 244000,
            },
          },
        },
      };
      
      // Resolve webpack cache warning
      config.cache = {
        ...config.cache,
        maxMemoryGenerations: 1, // Reduce memory usage
      };
    }

    return config;
  },

  // Build performance
  productionBrowserSourceMaps: false,

  // It's good practice to keep your image domains defined.
  images: {
    domains: ['localhost', 'lh3.googleusercontent.com', 'upload.wikimedia.org', 'images.unsplash.com'],
    formats: ['image/avif', 'image/webp'],
  },

  async rewrites() {
    return [
      {
        source: '/api/ixwiki-proxy/api.php/:path*',
        destination: 'https://ixwiki.com/api.php/:path*',
      },
      {
        source: '/api/iiwiki-proxy/mediawiki/api.php/:path*',
        destination: 'https://iiwiki.com/mediawiki/api.php/:path*',
      },
    ];
  },
};

export default config;
