/**
 * createRateLimitMiddleware passes each procedure's declared limits to the limiter (plan 340, Step 1).
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("@clerk/nextjs/server", () => ({ __esModule: true, getAuth: () => null }));
jest.mock("@clerk/nextjs", () => ({ __esModule: true, getAuth: () => null }));
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({ __esModule: true, isSystemOwner: () => false }));
jest.mock("~/lib/auth/system-owner-constants", () => ({ __esModule: true, isSystemOwner: () => false }));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  rateLimiter: {
    isEnabled: () => true,
    check: jest.fn(async () => ({ success: true, remaining: 10, resetAt: new Date() })),
  },
  createCacheMiddlewareFactory: jest.fn(),
  cacheConfigs: {},
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { t } from "~/server/api/trpc/init";
import type { TRPCContext } from "~/server/api/trpc/context";
import {
  publicRateLimit,
  readOnlyRateLimit,
  standardMutationRateLimit,
  lightMutationRateLimit,
  rateLimitMiddleware,
} from "~/server/api/trpc/middleware";
import { rateLimiter } from "~/lib/cache";

const ctx = { rateLimitIdentifier: "ip:203.0.113.7" } as TRPCContext;

const router = t.router({
  publicPing: t.procedure.use(publicRateLimit).query(() => "ok"),
  queryPing: t.procedure.use(readOnlyRateLimit).query(() => "ok"),
  mutationPing: t.procedure.use(standardMutationRateLimit).mutation(() => "ok"),
  lightPing: t.procedure.use(lightMutationRateLimit).mutation(() => "ok"),
  defaultPing: t.procedure.use(rateLimitMiddleware).query(() => "ok"),
});
const caller = t.createCallerFactory(router)(ctx);
const checkMock = jest.mocked(rateLimiter.check);

beforeEach(() => {
  checkMock.mockClear();
});

describe("createRateLimitMiddleware", () => {
  it.each([
    ["publicPing", "public", 100],
    ["queryPing", "queries", 120],
    ["mutationPing", "mutations", 60],
    ["lightPing", "light_mutations", 100],
    ["defaultPing", "default", 100],
  ] as const)("%s checks namespace %s with max %i per minute", async (procedure, namespace, max) => {
    await expect(caller[procedure]()).resolves.toBe("ok");
    expect(checkMock).toHaveBeenCalledWith("ip:203.0.113.7", namespace, {
      maxRequests: max,
      windowMs: 60000,
    });
  });
});
