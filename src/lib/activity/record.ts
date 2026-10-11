import type { PrismaClient, Priority } from "@prisma/client";
import { db } from "~/server/db";

/** Metadata values are the scalars the feed stores as JSON. */
export type ActivityMeta = Record<string, string | number | boolean | null>;

export interface ActivityRecord {
  type: string;
  category?: string;
  userId?: string | null;
  countryId?: string | null;
  title: string;
  description: string;
  eventType: string;
  /** Extra metadata fields, stored after `eventType`. */
  meta?: ActivityMeta;
  priority: Priority;
  visibility?: string;
  /** Countries the entry relates to (stored as JSON); null for none. */
  related: string[] | null;
  /** A fixed row id (a directive's `dir-<intentId>`), so a retry cannot write the entry twice. */
  id?: string;
  /** The client to write with; the shared `db` when absent. */
  client?: Pick<PrismaClient, "activityFeed">;
}

/** Writes one ActivityFeed entry and returns the created row. */
export function recordActivity({
  meta,
  eventType,
  related,
  userId,
  id,
  client,
  ...rest
}: ActivityRecord) {
  return (client ?? db).activityFeed.create({
    data: {
      category: "game",
      visibility: "public",
      ...rest,
      ...(id ? { id } : {}),
      userId: userId || null,
      metadata: JSON.stringify({ eventType, ...meta }),
      relatedCountries: related ? JSON.stringify(related) : null,
    },
  });
}
