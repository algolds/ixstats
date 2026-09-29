import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { resolveViewerRealmId } from "~/server/modules/realms";

export const realmScopeInput = z.object({ realm: z.string().max(100).optional() });

export function viewerRealmId(
  ctx: { db: Pick<PrismaClient, "realm">; user?: { country?: { realmId?: string | null } | null } | null },
  realmSlug?: string
): Promise<string> {
  return resolveViewerRealmId(ctx.db, { realmSlug, activeRealmId: ctx.user?.country?.realmId });
}
