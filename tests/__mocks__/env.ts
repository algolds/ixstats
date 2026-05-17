/**
 * Manual mock for ~/env module
 * 
 * This mock is used by Jest to avoid ESM import issues with @t3-oss/env-nextjs.
 * All tests that import modules using ~/env will automatically use this mock
 * when jest.mock("~/env") is called or via moduleNameMapper.
 */

export const env = {
  // Database
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/ixstats_test",
  DATABASE_READONLY: false,

  // Node environment
  NODE_ENV: "test" as const,

  // Base paths
  BASE_PATH: "",
  NEXT_PUBLIC_BASE_PATH: "",

  // External services
  NEXT_PUBLIC_MEDIAWIKI_URL: "https://ixwiki.com/",
  IXTIME_BOT_URL: "http://localhost:3001",

  // Clerk (optional in test)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_mock",
  CLERK_SECRET_KEY: "sk_test_mock",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",

  // Redis (optional)
  REDIS_URL: undefined,

  // Feature flags
  NEXT_PUBLIC_IXWORLD_STANDALONE: false,
  SKIP_ENV_VALIDATION: true,
};

// Default export for compatibility
export default { env };
