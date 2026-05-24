// src/env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Base path for deployment under subpath (e.g., /projects/ixstates)
    BASE_PATH: z.string().optional().default(""),
    // Discord Bot IxTime API Configuration
    IXTIME_BOT_URL: z.string().url().optional().default("http://localhost:3001"),
    // Secret for bot-to-server sync authentication
    IXTIME_BOT_SECRET: z.string().optional(),
    // Optional: Discord Bot Configuration (if needed for direct bot integration)
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_GUILD_ID: z.string().optional(),
    // Clerk Authentication Configuration - Required in production
    CLERK_SECRET_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1, "CLERK_SECRET_KEY is required in production")
        : z.string().optional(),
    // Discord Webhook Configuration (optional)
    DISCORD_WEBHOOK_URL: z.string().url().optional(),
    DISCORD_WEBHOOK_ENABLED: z.string().optional().default("false"),
    // Redis Configuration (optional - for production rate limiting)
    REDIS_URL: z.string().url().optional(),
    REDIS_ENABLED: z.string().optional().default("false"),
    // Rate Limiting Configuration
    RATE_LIMIT_ENABLED: z.string().optional().default("true"),
    RATE_LIMIT_MAX_REQUESTS: z.string().optional().default("100"),
    RATE_LIMIT_WINDOW_MS: z.string().optional().default("60000"),
    // Performance & Optimization
    ENABLE_COMPRESSION: z.string().optional().default("true"),
    ENABLE_CACHING: z.string().optional().default("true"),
    CACHE_TTL_SECONDS: z.string().optional().default("3600"),
    // IxWiki Local Path (for same-server optimization)
    IXWIKI_LOCAL_PATH: z.string().optional(),
    // Admin contact email (used in API User-Agents for external services)
    ADMIN_EMAIL: z.string().email().optional(),
    // NationStates verification secret (required for NS nation verification)
    NS_VERIFICATION_SECRET: z.string().optional(),
    // XenForo Forum API Configuration
    XENFORO_API_KEY: z.string().optional(),
    XENFORO_API_URL: z.string().url().optional().default("https://forum.ixwiki.com/api"),
    // IxWiki MySQL direct access (for wiki-bridge.ts read queries)
    IXWIKI_DB_HOST: z.string().optional().default("localhost"),
    IXWIKI_DB_PORT: z.coerce.number().optional().default(3306),
    IXWIKI_DB_USER: z.string().optional().default("ixwiki"),
    IXWIKI_DB_PASSWORD: z.string().optional(),
    IXWIKI_DB_NAME: z.string().optional().default("ixwiki"),
    // IxWiki image base URL (for file/image serving)
    IXWIKI_IMAGE_BASE_URL: z.string().optional().default("https://ixwiki.com/images"),
    // Unsplash API (for country card images)
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    // Server port
    PORT: z.string().optional().default("3550"),
    // Vercel URL (auto-set by Vercel)
    VERCEL_URL: z.string().optional(),
    // App URL for self-referencing
    APP_URL: z.string().url().optional(),
    // Cron job secret for scheduled tasks - REQUIRED in production
    CRON_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(32, "CRON_SECRET must be at least 32 characters in production")
        : z.string().optional(),
    // System owner Clerk IDs (comma-separated) - loaded from env for security
    SYSTEM_OWNER_IDS: z.string().optional(),
    // WikiOS MediaWiki Bot Username
    WIKIOS_MEDIAWIKI_BOT_USER: z.string().optional().default("Heku@WikiOS"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Base path for client-side routing
    NEXT_PUBLIC_BASE_PATH: z.string().optional().default(""),
    // If you need the bot URL on the client side for direct API calls:
    NEXT_PUBLIC_IXTIME_BOT_URL: z.string().url().optional().default("http://localhost:3001"),
    // MediaWiki API URL for country data and flags
    NEXT_PUBLIC_MEDIAWIKI_URL: z.string().url().optional().default("https://ixwiki.com/"),
    // Clerk Authentication Configuration (Client-side) - Required in production
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production")
        : z.string().optional(),
    // App URL for client-side self-referencing
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    // Enable intel suggestions feature flag
    NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS: z.string().optional().default("false"),
    // Unsplash API (for country card images) - required for client-side fetching
    NEXT_PUBLIC_UNSPLASH_ACCESS_KEY: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BASE_PATH: process.env.BASE_PATH,
    IXTIME_BOT_URL: process.env.IXTIME_BOT_URL,
    IXTIME_BOT_SECRET: process.env.IXTIME_BOT_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_IXTIME_BOT_URL: process.env.NEXT_PUBLIC_IXTIME_BOT_URL,
    NEXT_PUBLIC_MEDIAWIKI_URL: process.env.NEXT_PUBLIC_MEDIAWIKI_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS: process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS,
    // Clerk Authentication Configuration
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    // Discord Webhook
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    DISCORD_WEBHOOK_ENABLED: process.env.DISCORD_WEBHOOK_ENABLED,
    // Redis
    REDIS_URL: process.env.REDIS_URL,
    REDIS_ENABLED: process.env.REDIS_ENABLED,
    // Rate Limiting
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    // Performance
    ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION,
    ENABLE_CACHING: process.env.ENABLE_CACHING,
    CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS,
    // IxWiki Local Path
    IXWIKI_LOCAL_PATH: process.env.IXWIKI_LOCAL_PATH,
    // Admin Email
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    // NationStates
    NS_VERIFICATION_SECRET: process.env.NS_VERIFICATION_SECRET,
    // XenForo Forum
    XENFORO_API_KEY: process.env.XENFORO_API_KEY,
    XENFORO_API_URL: process.env.XENFORO_API_URL,
    // IxWiki MySQL
    IXWIKI_DB_HOST: process.env.IXWIKI_DB_HOST,
    IXWIKI_DB_PORT: process.env.IXWIKI_DB_PORT,
    IXWIKI_DB_USER: process.env.IXWIKI_DB_USER,
    IXWIKI_DB_PASSWORD: process.env.IXWIKI_DB_PASSWORD,
    IXWIKI_DB_NAME: process.env.IXWIKI_DB_NAME,
    IXWIKI_IMAGE_BASE_URL: process.env.IXWIKI_IMAGE_BASE_URL,
    // Unsplash
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    NEXT_PUBLIC_UNSPLASH_ACCESS_KEY: process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY,
    // Server
    PORT: process.env.PORT,
    VERCEL_URL: process.env.VERCEL_URL,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    SYSTEM_OWNER_IDS: process.env.SYSTEM_OWNER_IDS,
    WIKIOS_MEDIAWIKI_BOT_USER: process.env.WIKIOS_MEDIAWIKI_BOT_USER,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
