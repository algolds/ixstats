import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Loads `.env*` files into process.env for the standalone entry points (server.mjs,
 * ws-backend.mjs, cron-runner.mjs). Variables already set win, then earlier files win.
 * The order follows Next.js precedence and start-production.sh (which sources
 * `.env.production` then `.env.production.local`): `.env.production.local` holds the
 * prod secrets and must beat the `.env.production` template, or the ws and cron
 * processes can run with a placeholder the web process overrides.
 */
export const ENV_FILES = {
  production: [".env.production.local", ".env.local", ".env.production", ".env"],
  development: [".env.local.dev", ".env.local", ".env"],
};

export function loadEnvVariables(logPrefix) {
  const envFiles =
    process.env.NODE_ENV === "production" ? ENV_FILES.production : ENV_FILES.development;

  for (const file of envFiles) {
    const absolutePath = resolve(process.cwd(), file);
    if (!existsSync(absolutePath)) continue;
    try {
      for (const rawLine of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
        if (Object.hasOwn(process.env, key)) continue;
        process.env[key] = value;
      }
    } catch (error) {
      console.warn(`${logPrefix} Failed to load env file ${file}:`, error.message);
    }
  }
}
