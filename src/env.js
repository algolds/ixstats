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
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Discord Bot IxTime API Configuration
    IXTIME_BOT_URL: z
      .string()
      .url()
      .optional()
      .default("http://localhost:3001"),
    // Optional: Discord Bot Configuration (if needed for direct bot integration)
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_GUILD_ID: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
    // If you need the bot URL on the client side for direct API calls:
    NEXT_PUBLIC_IXTIME_BOT_URL: z
      .string()
      .url()
      .optional()
      .default("http://localhost:3001"),
    // MediaWiki API URL for country data and flags
    NEXT_PUBLIC_MEDIAWIKI_URL: z
      .string()
      .url()
      .optional()
      .default("https://wiki.ixnay.com/"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    IXTIME_BOT_URL: process.env.IXTIME_BOT_URL,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    NEXT_PUBLIC_IXTIME_BOT_URL: process.env.NEXT_PUBLIC_IXTIME_BOT_URL,
    NEXT_PUBLIC_MEDIAWIKI_URL: process.env.NEXT_PUBLIC_MEDIAWIKI_URL,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
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