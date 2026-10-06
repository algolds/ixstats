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
    // NationStates verification secret (required for NS nation verification)
    NS_VERIFICATION_SECRET: z.string().optional(),
    // XenForo Forum API Configuration
    XENFORO_API_KEY: z.string().optional(),
    XENFORO_API_URL: z.string().url().optional().default("https://forum.ixwiki.com/api"),
    // HMAC key for forum account verification codes (falls back to CRON_SECRET when unset)
    FORUM_VERIFICATION_SECRET: z.string().optional(),
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
    // HMAC key for WikiOS api.php sessions and tokens (src/lib/wiki-os/api-compat/auth.ts). Optional, and any
    // string is accepted here, on purpose: a missing or too short key must never stop the app from starting.
    // api.php treats a value under 32 characters as unset: it answers `sessionsecretmissing` to a login, a login
    // token and any request that carries a session cookie (it never signs or accepts one with a fallback or
    // short key), logs one warning, and keeps serving anonymous reads.
    WIKIOS_API_SESSION_SECRET: z.string().optional(),
    // cron-runner.mjs job allowlist: comma-separated names from src/server/cron/jobs.ts, or "*".
    // Unset/empty schedules nothing.
    CRON_ENABLED_JOBS: z.string().optional(),
    // Extra browser origins (comma-separated full URLs) allowed to open the ThinkPages socket,
    // on top of NEXT_PUBLIC_APP_URL. Read by src/lib/websocket/socket-auth.ts; fails closed.
    WS_ALLOWED_ORIGINS: z.string().optional(),
    // System owner Clerk IDs (comma-separated) - loaded from env for security
    SYSTEM_OWNER_IDS: z.string().optional(),
    // The mirror's MediaWiki bot login, "<Account>@<bot name>" (Special:BotPasswords). No default: without it the
    // mirror has no account to write as, so its jobs fail (it never writes anonymously, csrf-cache.ts). It must be
    // the dedicated `WikiOSMirror` account, in the `wikios-mirror` group (plan 417's LocalSettings snippet), with
    // the `import`, `importupload`, `edit`, `bot`, `move`, `delete`, `undelete` and `protect` grants.
    WIKIOS_MEDIAWIKI_BOT_USER: z.string().optional(),
    // Declared for visibility; call sites still read process.env directly (plan 339).
    // MediaWiki bot password (lgpassword) for the WikiOS bot login (csrf-cache.ts)
    WIKIOS_MEDIAWIKI_BOT_TOKEN: z.string().optional(),
    // MediaWiki api.php URL the mirror logs in to and writes through (default: WIKIOS_MEDIAWIKI_INTERNAL_URL, else the public api.php)
    WIKIOS_MEDIAWIKI_API: z.string().optional(),
    // Internal (same-server) ixwiki api.php URL that overrides the public one for every server-side call: renders, reads and the mirror's writes
    WIKIOS_MEDIAWIKI_INTERNAL_URL: z.string().optional(),
    // iiwiki api.php proxy URL that overrides the default iiwiki endpoint
    IIWIKI_DEV_PROXY_URL: z.string().optional(),
    // TemplateStyles <style> in article HTML: on when unset, empty, "1", "true", "on" or "yes"; ANY other value ("0", "off", a typo) removes every <style> (the pre-plan-415 behaviour): the emergency lever if a CSS bypass is reported. config.ts reads it once, and it is part of the sanitizer fingerprint
    WIKIOS_TEMPLATESTYLES: z.string().optional(),
    // "true" stops the mirror worker (services/mirror-worker.ts): outbox jobs accumulate and nothing is lost
    SKIP_MEDIAWIKI_SYNC: z.string().optional(),
    // WikiOS v1 switch, off when unset: WikiOS stays read-only (no edits, uploads, imports, api.php, mirror,
    // render refresh or parked revisions) until the cutover turns it on. lib/wiki-os/v1-switch.ts reads it.
    WIKIOS_V1_ENABLED: z.string().optional(),
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
    // Public origin of the wiki; `src/lib/wiki-os/config.ts` owns the default and every reader of it
    NEXT_PUBLIC_MEDIAWIKI_URL: z.string().url().optional(),
    // Clerk Authentication Configuration (Client-side) - Required in production
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production")
        : z.string().optional(),
    // App URL for client-side self-referencing
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
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
    // "true" for the WikiOS standalone build (ixwiki.com/wiki/*): empty base path, other paths go to IxStates
    NEXT_PUBLIC_WIKIOS_STANDALONE: z.enum(["true", "false"]).optional(),
    // IxStates base URL that the WikiOS standalone build redirects non-wiki paths to; required there, no default
    NEXT_PUBLIC_IXSTATES_URL: z.string().url().optional(),
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
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_IXTIME_BOT_URL: process.env.NEXT_PUBLIC_IXTIME_BOT_URL,
    NEXT_PUBLIC_MEDIAWIKI_URL: process.env.NEXT_PUBLIC_MEDIAWIKI_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
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
    // NationStates
    NS_VERIFICATION_SECRET: process.env.NS_VERIFICATION_SECRET,
    // XenForo Forum
    XENFORO_API_KEY: process.env.XENFORO_API_KEY,
    XENFORO_API_URL: process.env.XENFORO_API_URL,
    FORUM_VERIFICATION_SECRET: process.env.FORUM_VERIFICATION_SECRET,
    NEXT_PUBLIC_GIPHY_API_KEY: process.env.NEXT_PUBLIC_GIPHY_API_KEY,
    // Server
    PORT: process.env.PORT,
    VERCEL_URL: process.env.VERCEL_URL,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    WIKI_SYNC_WEBHOOK_SECRET: process.env.WIKI_SYNC_WEBHOOK_SECRET,
    WIKIOS_API_SESSION_SECRET: process.env.WIKIOS_API_SESSION_SECRET,
    CRON_ENABLED_JOBS: process.env.CRON_ENABLED_JOBS,
    WS_ALLOWED_ORIGINS: process.env.WS_ALLOWED_ORIGINS,
    SYSTEM_OWNER_IDS: process.env.SYSTEM_OWNER_IDS,
    WIKIOS_MEDIAWIKI_BOT_USER: process.env.WIKIOS_MEDIAWIKI_BOT_USER,
    WIKIOS_MEDIAWIKI_BOT_TOKEN: process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN,
    WIKIOS_MEDIAWIKI_API: process.env.WIKIOS_MEDIAWIKI_API,
    WIKIOS_MEDIAWIKI_INTERNAL_URL: process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL,
    IIWIKI_DEV_PROXY_URL: process.env.IIWIKI_DEV_PROXY_URL,
    WIKIOS_TEMPLATESTYLES: process.env.WIKIOS_TEMPLATESTYLES,
    SKIP_MEDIAWIKI_SYNC: process.env.SKIP_MEDIAWIKI_SYNC,
    WIKIOS_V1_ENABLED: process.env.WIKIOS_V1_ENABLED,
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
    NEXT_PUBLIC_WIKIOS_STANDALONE: process.env.NEXT_PUBLIC_WIKIOS_STANDALONE,
    NEXT_PUBLIC_IXSTATES_URL: process.env.NEXT_PUBLIC_IXSTATES_URL,
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
