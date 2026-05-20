// @ts-nocheck
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

// Skip env validation in next.config.js to avoid TypeScript import issues
// The env validation will be handled by the application at runtime
// This is a common pattern when using TypeScript env files with JavaScript config files

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
    "xlsx",
    "mysql2",
    "jspdf",
    "@xmldom/xmldom",
    "node-cron",
    "node-schedule",
    "ioredis",
  ],

  experimental: {
    // Enable optimizations for heavy packages (tree-shakes unused exports)
    optimizePackageImports: [
      // NOTE: lucide-react removed from here — optimizePackageImports was
      // incorrectly dropping Link2 and other icons. Next.js production builds
      // still tree-shake unused lucide icons automatically.
      "recharts",              // 8MB charting library
      "react-icons/ri",        // 2500+ Remix Icons barrel
      "react-icons/fa",        // FontAwesome barrel
      "react-icons/fa6",       // FontAwesome 6 barrel
      "react-icons/gi",        // Game Icons barrel
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@clerk/nextjs",
      "@tabler/icons-react",
      "@base-ui-components/react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-slider",
      "@radix-ui/react-switch",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-progress",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
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

  // Build performance
  productionBrowserSourceMaps: false,

  // Strip console.log in production (keeps errors/warnings)
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },

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
    ];

    if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
      return {
        beforeFiles: [
          {
            // Map root-level slugs to countries/[slug] for standalone mode
            // Exclude all top-level app routes so existing pages are not intercepted
            source:
              "/:slug((?!achievements|admin|api|blurbs|builder|countries|dashboard|dm-dashboard|explore|favicon\\.ico|feed|flags|forum|hashtags|health|help|leaderboards|maps|messages|mycountry|placeholder|profile|setup|sign-in|sign-up|studio|thinkpages|vault|w|wiki|_next).*)",
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
          // Let React Query control caching — HTTP cache caused stale data for up to 1hr
          { key: "Cache-Control", value: "no-cache" },
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

// Bundle analyzer (enabled via ANALYZE=true environment variable)
// Run: ANALYZE=true bun run build
let analyzerConfig = config;
try {
  const withBundleAnalyzer = (await import("@next/bundle-analyzer")).default;
  analyzerConfig = withBundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
    openAnalyzer: false,
  })(config);
} catch {
  // @next/bundle-analyzer not installed — skip
}

export default analyzerConfig;
