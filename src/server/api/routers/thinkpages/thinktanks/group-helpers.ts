/** Helpers for ThinkTank group rows (split out of groups.ts). */

import type { PrismaClient } from "@prisma/client";

export type GroupMemberRow = { userId: string; role: string };

export type GroupSettings = {
  allowPersonaPosting?: boolean;
  rules?: string;
  bannerUrl?: string;
  themeAccent?: string;
  pinnedDocIds?: string[];
};

export function parseGroupSettings(raw: string | null, groupId: string): GroupSettings {
  const settings: GroupSettings = { allowPersonaPosting: false };
  if (!raw) return settings;
  try {
    return { ...settings, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("[ThinkTanks] Malformed settings on group", groupId, err);
    return settings;
  }
}

export function parseGroupTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [raw];
  }
}

export function viewerMembership(
  group: { createdBy: string; members: GroupMemberRow[] },
  viewerId: string
) {
  if (!viewerId) return { isMember: false, userRole: null };
  const isOwner = group.createdBy === viewerId;
  const isMember = isOwner || group.members.some((m) => m.userId === viewerId);
  const userRole = isOwner
    ? "owner"
    : group.members.find((m) => m.userId === viewerId)?.role || (isMember ? "member" : null);
  return { isMember, userRole };
}

/** Auto-heal a missing ThinkShare conversation for the group (mutates `group` to match). */
export async function healGroupConversation(
  db: Pick<PrismaClient, "thinkshareConversation" | "thinktankGroup">,
  group: {
    id: string;
    name: string;
    avatar: string | null;
    conversationId: string | null;
    conversation: { id: string; lastActivity: Date } | null;
    members: GroupMemberRow[];
  }
) {
  if (group.conversationId && group.conversation) return;
  try {
    const newConv = await db.thinkshareConversation.create({
      data: {
        type: "group",
        name: group.name,
        avatar: group.avatar,
        source: "thinktank",
        sourceId: group.id,
        participants: {
          create: group.members.map((m) => ({
            userId: m.userId,
            role: m.role === "owner" || m.role === "admin" ? "admin" : "participant",
          })),
        },
      },
    });

    await db.thinktankGroup.update({
      where: { id: group.id },
      data: { conversationId: newConv.id },
    });

    group.conversationId = newConv.id;
    group.conversation = { id: newConv.id, lastActivity: newConv.createdAt };
  } catch (e) {
    console.warn("[ThinkTanks] Failed to auto-heal group conversation:", e);
  }
}
