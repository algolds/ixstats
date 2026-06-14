/**
 * Manual mock for ~/env module
 *
 * This mock is used by Jest to avoid ESM import issues with @t3-oss/env-nextjs.
 */

export const env = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/ixstats_test",
  DATABASE_READONLY: false,
  NODE_ENV: "test" as const,
  BASE_PATH: "",
  NEXT_PUBLIC_BASE_PATH: "",
  NEXT_PUBLIC_MEDIAWIKI_URL: "https://ixwiki.com/",
  IXTIME_BOT_URL: "http://localhost:3001",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_mock",
  CLERK_SECRET_KEY: "sk_test_mock",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  REDIS_URL: undefined,
  NEXT_PUBLIC_IXWORLD_STANDALONE: false,
  SKIP_ENV_VALIDATION: true,
};

export default { env };
