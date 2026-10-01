/**
 * deps.ts — the real dependencies of the api.php endpoint (plan 410): the Prisma store, the
 * existing rights engine, the shared rate limiter and the clock. Tests build `ApiDeps` by hand.
 */

import { rateLimiter } from "~/lib/cache/rate-limiter";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { capWikiPermissions, getWikiPermissions } from "~/lib/wiki-os/rights";
import { prismaAuthStore } from "./auth-store";
import { prismaApiStore } from "./store";
import type { ApiDeps } from "./types";

export function createApiDeps(): ApiDeps {
  return {
    auth: prismaAuthStore,
    loadPermissions: (ctx, ceiling) =>
      ceiling ? capWikiPermissions(ctx, ceiling) : getWikiPermissions(ctx),
    rateLimit: (identity, bucket, limits) => rateLimiter.check(identity, bucket, limits),
    store: prismaApiStore,
    siteUrl: getWikiBaseUrl().replace(/\/+$/, ""),
    now: () => new Date(),
  };
}
