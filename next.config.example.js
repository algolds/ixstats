// @ts-nocheck
/**
 * Template for next.config.js, which is git-ignored: each environment (dev machines, the
 * production server) keeps its own copy. Copy this file to next.config.js to run or build the app.
 *
 * Reconstructed on 2026-10-05 from the last tracked copy (removed from git on 2026-06-03) plus
 * the later changes CHANGELOG records: TypeScript build errors fail the build, packages that are no
 * longer dependencies are dropped, and `/@handle` rewrites to the IxnayID passport (`/id/[username]`).
 * The server's copy is the source of truth: when you change it, mirror the change here.
 *
 * No secrets belong in this file; they live in .env files.
 */

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
  // IxWorld standalone (maps.ixwiki.com) always uses an empty base path
  if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
    return "";
  }

  const hasBasePathEnv = Object.prototype.hasOwnProperty.call(process.env, "BASE_PATH");
  const rawBasePath = hasBasePathEnv
    ? process.env.BASE_PATH
    : process.env.NODE_ENV === "production"
      ? "/projects/ixstates"
      : "";
  return normalizeBasePath(rawBasePath);
};

const basePath = resolveBasePath();
const assetPrefix = basePath || undefined;

/** @type {import("next").NextConfig} */
const config = {
  basePath,
  assetPrefix,

  trailingSlash: false,
  reactStrictMode: true,

  // Server-only packages loaded at runtime instead of bundled
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "sharp",
    "mysql2",
    "@xmldom/xmldom",
    "ioredis",
  ],

  experimental: {
    // Tree-shake barrel imports of heavy packages. lucide-react is left out on purpose: this
    // option dropped Link2 and other icons, and production builds tree-shake it anyway.
    optimizePackageImports: [
      "recharts",
      "@clerk/nextjs",
      "@radix-ui/react-accordion",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
    esmExternals: true,
  },

  // Builds fail on type errors (src/tests/scripts/verification-gates.test.ts checks this)
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "./tsconfig.json",
  },

  productionBrowserSourceMaps: false,

  // Strip console.log in production (keeps errors and warnings)
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },

  webpack(webpackConfig) {
    if (webpackConfig.resolve) {
      webpackConfig.resolve.symlinks = false;
    }
    return webpackConfig;
  },

  turbopack: {},

  compress: process.env.NODE_ENV === "production",
  poweredByHeader: false,

  // start-production.sh serves the standalone build
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "localhost" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ixwiki.com" },
      { protocol: "https", hostname: "iiwiki.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "media.discordapp.net" },
      // NationStates images go through /api/proxy-ns-image, so no NS hosts here
    ],
    // Local API routes with query strings (NS image proxy, placeholders)
    localPatterns: [{ pathname: "/**" }],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async rewrites() {
    const baseRewrites = [
      { source: "/api/ixwiki-proxy/:path*", destination: "https://ixwiki.com/:path*" },
      // IxnayID passports: /@handle (the page strips a leading @)
      { source: "/@:handle", destination: "/id/:handle" },
    ];

    if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
      return {
        beforeFiles: [
          {
            // Map root-level slugs to countries/[slug] in standalone mode, leaving app routes alone
            source:
              "/:slug((?!achievements|admin|api|blurbs|builder|countries|dashboard|data|dm-dashboard|explore|favicon\\.ico|feed|flags|fonts|forum|hashtags|health|help|id|images|leaderboards|maps|messages|mycountry|placeholder|profile|r|realms|settings|setup|sign-in|sign-up|sounds|studio|thinkpages|vault|w|wiki|_next|@).*)",
            destination: "/countries/:slug",
          },
        ],
        fallback: baseRewrites,
      };
    }

    return baseRewrites;
  },

  async redirects() {
    return [
      { source: "/profile", destination: "/settings", permanent: true },
      { source: "/profile/:path*", destination: "/settings/:path*", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        // React Query controls caching; an HTTP cache served stale map data for up to an hour
        source: "/api/trpc/geo.:path*",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default config;
