/** Pure parsing helpers for ThinkTank group rows (split out of groups.ts). */

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
