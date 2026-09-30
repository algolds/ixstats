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
    // Secret for bot-to-server sync authentication - REQUIRED in production
    IXTIME_BOT_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1, "IXTIME_BOT_SECRET is required in production")
        : z.string().optional(),
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
    // HMAC key for forum account verification codes (falls back to CRON_SECRET when unset)
    FORUM_VERIFICATION_SECRET: z.string().optional(),
    // IxWiki MySQL direct access (for wiki-bridge.ts read queries)
    IXWIKI_DB_HOST: z.string().optional().default("localhost"),
    IXWIKI_DB_PORT: z.coerce.number().optional().default(3306),
    IXWIKI_DB_USER: z.string().optional().default("ixwiki"),
    IXWIKI_DB_PASSWORD: z.string().optional(),
    IXWIKI_DB_NAME: z.string().optional().default("ixwiki"),
    // IxWiki image base URL (for file/image serving)
    IXWIKI_IMAGE_BASE_URL: z.string().optional().default("https://ixwiki.com/images"),
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
    // Shared secret MediaWiki sends to /api/wiki/sync-webhook and /api/wikios/inbound-sync
    // (header x-wiki-webhook-secret or Authorization: Bearer) - REQUIRED in production
    WIKI_SYNC_WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z
            .string()
            .min(32, "WIKI_SYNC_WEBHOOK_SECRET must be at least 32 characters in production")
        : z.string().optional(),
    // cron-runner.mjs job allowlist: comma-separated names from src/server/cron/jobs.ts, or "*".
    // Unset/empty schedules nothing.
    CRON_ENABLED_JOBS: z.string().optional(),
    // Extra browser origins (comma-separated full URLs) allowed to open the ThinkPages socket,
    // on top of NEXT_PUBLIC_APP_URL. Read by src/lib/websocket/socket-auth.ts; fails closed.
    WS_ALLOWED_ORIGINS: z.string().optional(),
    // System owner Clerk IDs (comma-separated) - loaded from env for security
    SYSTEM_OWNER_IDS: z.string().optional(),
    // WikiOS MediaWiki Bot Username
    WIKIOS_MEDIAWIKI_BOT_USER: z.string().optional().default("Heku@WikiOS"),
    // Declared for visibility; call sites still read process.env directly (plan 339).
    // MediaWiki bot password (lgpassword) for the WikiOS bot login (csrf-cache.ts)
    WIKIOS_MEDIAWIKI_BOT_TOKEN: z.string().optional(),
    // MediaWiki api.php URL used for WikiOS writes and CSRF tokens
    WIKIOS_MEDIAWIKI_API: z.string().optional(),
    // Internal (same-server) ixwiki api.php URL that overrides the public one for reads
    WIKIOS_MEDIAWIKI_INTERNAL_URL: z.string().optional(),
    // iiwiki api.php proxy URL that overrides the default iiwiki endpoint
    IIWIKI_DEV_PROXY_URL: z.string().optional(),
    // "true" stops WikiOS from queueing background MediaWiki sync jobs (sync-worker.ts)
    SKIP_MEDIAWIKI_SYNC: z.string().optional(),
    // Cloudflare Turnstile secret for verifying WikiOS challenge tokens
    CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().optional(),
    // Cloudflare API token + zone for purging article edge cache on save (both needed)
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_ZONE_ID: z.string().optional(),
    // API key the Discord bot sends to /api/bot/lorewards/sync
    BOT_API_KEY: z.string().optional(),
    // Discord channel mirrored into IxTwitter/ThinkPages (code has a fallback channel)
    DISCORD_IXTWITTER_CHANNEL_ID: z.string().optional(),
    // Country ID that synced Discord posts are attributed to (falls back to a DB lookup)
    DISCORD_POST_COUNTRY_ID: z.string().optional(),
    // "true" puts the Prisma client in read-only mode (src/server/db.ts)
    DATABASE_READONLY: z.string().optional(),
    // "true" logs messaging telemetry even under NODE_ENV=test
    DEBUG_TELEMETRY: z.string().optional(),
    // "true" enables verbose tRPC context/middleware logging
    TRPC_VERBOSE: z.string().optional(),
    // National issues gameplay flags ("0"/"false" off, "1"/"true" on; see gameplay-flags.ts)
    ISSUES_AUTO_GENERATE: z.string().optional(),
    ISSUES_ENFORCE_DEADLINES: z.string().optional(),
    ISSUES_AWARD_CREDITS: z.string().optional(),
    // Neighbor-aware national issues; on unless "0"/"false" (national-issues/neighbors.ts)
    ISSUES_NEIGHBORS: z.string().optional(),
    // Narrator LLM (lib/narrator/client.ts); independent of the SPORTS_LLM_* keys (no fallback)
    NARRATOR_LLM_API_KEY: z.string().optional(),
    NARRATOR_LLM_API_URL: z.string().optional(),
    NARRATOR_LLM_MODEL: z.string().optional(),
    NARRATOR_LLM_PROVIDER: z.string().optional(),
    // "true" enables reasoning mode for narrator LLM requests
    NARRATOR_LLM_REASONING: z.string().optional(),
    // Sports commentary LLM (lib/sports/commentary/narrator.ts); "true" enables commentary
    SPORTS_LLM_COMMENTARY: z.string().optional(),
    SPORTS_LLM_API_KEY: z.string().optional(),
    SPORTS_LLM_API_URL: z.string().optional(),
    SPORTS_LLM_MODEL: z.string().optional(),
    SPORTS_LLM_PROVIDER: z.string().optional(),
    // Sports commentary text-to-speech; "true" enables it
    SPORTS_TTS_ENABLED: z.string().optional(),
    SPORTS_TTS_API_KEY: z.string().optional(),
    SPORTS_TTS_API_URL: z.string().optional(),
    // Unsplash API access key for the media image search
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    // Directory for uploaded images (defaults to public/images/uploads)
    UPLOAD_DIR: z.string().optional(),
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
    // Giphy API key for ThinkPages composer
    NEXT_PUBLIC_GIPHY_API_KEY: z.string().optional(),
    // Sign-in page URL for Halo sign-in links (defaults to /sign-in)
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().optional(),
    // "true" lets the ThinkPages client open its WebSocket
    NEXT_PUBLIC_ENABLE_WEBSOCKET: z.string().optional(),
    // Port of the ThinkPages WebSocket server
    NEXT_PUBLIC_WS_PORT: z.string().optional(),
    // "true" for the IxWorld standalone build (maps.ixwiki.com): empty base path
    NEXT_PUBLIC_IXWORLD_STANDALONE: z.string().optional(),
    // Map glyph (font PBF) URL template that overrides the default
    NEXT_PUBLIC_MAP_GLYPHS_URL: z.string().optional(),
    // "true" grants MyCountry Premium features to every user (test builds; keep off in production)
    NEXT_PUBLIC_PREMIUM_FOR_ALL: z.string().optional(),
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
    FORUM_VERIFICATION_SECRET: process.env.FORUM_VERIFICATION_SECRET,
    // IxWiki MySQL
    IXWIKI_DB_HOST: process.env.IXWIKI_DB_HOST,
    IXWIKI_DB_PORT: process.env.IXWIKI_DB_PORT,
    IXWIKI_DB_USER: process.env.IXWIKI_DB_USER,
    IXWIKI_DB_PASSWORD: process.env.IXWIKI_DB_PASSWORD,
    IXWIKI_DB_NAME: process.env.IXWIKI_DB_NAME,
    IXWIKI_IMAGE_BASE_URL: process.env.IXWIKI_IMAGE_BASE_URL,
    NEXT_PUBLIC_GIPHY_API_KEY: process.env.NEXT_PUBLIC_GIPHY_API_KEY,
    // Server
    PORT: process.env.PORT,
    VERCEL_URL: process.env.VERCEL_URL,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    WIKI_SYNC_WEBHOOK_SECRET: process.env.WIKI_SYNC_WEBHOOK_SECRET,
    CRON_ENABLED_JOBS: process.env.CRON_ENABLED_JOBS,
    WS_ALLOWED_ORIGINS: process.env.WS_ALLOWED_ORIGINS,
    SYSTEM_OWNER_IDS: process.env.SYSTEM_OWNER_IDS,
    WIKIOS_MEDIAWIKI_BOT_USER: process.env.WIKIOS_MEDIAWIKI_BOT_USER,
    WIKIOS_MEDIAWIKI_BOT_TOKEN: process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN,
    WIKIOS_MEDIAWIKI_API: process.env.WIKIOS_MEDIAWIKI_API,
    WIKIOS_MEDIAWIKI_INTERNAL_URL: process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL,
    IIWIKI_DEV_PROXY_URL: process.env.IIWIKI_DEV_PROXY_URL,
    SKIP_MEDIAWIKI_SYNC: process.env.SKIP_MEDIAWIKI_SYNC,
    CLOUDFLARE_TURNSTILE_SECRET_KEY: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
    BOT_API_KEY: process.env.BOT_API_KEY,
    DISCORD_IXTWITTER_CHANNEL_ID: process.env.DISCORD_IXTWITTER_CHANNEL_ID,
    DISCORD_POST_COUNTRY_ID: process.env.DISCORD_POST_COUNTRY_ID,
    DATABASE_READONLY: process.env.DATABASE_READONLY,
    DEBUG_TELEMETRY: process.env.DEBUG_TELEMETRY,
    TRPC_VERBOSE: process.env.TRPC_VERBOSE,
    ISSUES_AUTO_GENERATE: process.env.ISSUES_AUTO_GENERATE,
    ISSUES_ENFORCE_DEADLINES: process.env.ISSUES_ENFORCE_DEADLINES,
    ISSUES_AWARD_CREDITS: process.env.ISSUES_AWARD_CREDITS,
    ISSUES_NEIGHBORS: process.env.ISSUES_NEIGHBORS,
    NARRATOR_LLM_API_KEY: process.env.NARRATOR_LLM_API_KEY,
    NARRATOR_LLM_API_URL: process.env.NARRATOR_LLM_API_URL,
    NARRATOR_LLM_MODEL: process.env.NARRATOR_LLM_MODEL,
    NARRATOR_LLM_PROVIDER: process.env.NARRATOR_LLM_PROVIDER,
    NARRATOR_LLM_REASONING: process.env.NARRATOR_LLM_REASONING,
    SPORTS_LLM_COMMENTARY: process.env.SPORTS_LLM_COMMENTARY,
    SPORTS_LLM_API_KEY: process.env.SPORTS_LLM_API_KEY,
    SPORTS_LLM_API_URL: process.env.SPORTS_LLM_API_URL,
    SPORTS_LLM_MODEL: process.env.SPORTS_LLM_MODEL,
    SPORTS_LLM_PROVIDER: process.env.SPORTS_LLM_PROVIDER,
    SPORTS_TTS_ENABLED: process.env.SPORTS_TTS_ENABLED,
    SPORTS_TTS_API_KEY: process.env.SPORTS_TTS_API_KEY,
    SPORTS_TTS_API_URL: process.env.SPORTS_TTS_API_URL,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_ENABLE_WEBSOCKET: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET,
    NEXT_PUBLIC_WS_PORT: process.env.NEXT_PUBLIC_WS_PORT,
    NEXT_PUBLIC_IXWORLD_STANDALONE: process.env.NEXT_PUBLIC_IXWORLD_STANDALONE,
    NEXT_PUBLIC_MAP_GLYPHS_URL: process.env.NEXT_PUBLIC_MAP_GLYPHS_URL,
    NEXT_PUBLIC_PREMIUM_FOR_ALL: process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL,
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
