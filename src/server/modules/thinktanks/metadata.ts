/**
 * The tab title of `/thinktanks/{groupId}`. Only an active group anyone may read gives its name, so
 * a private group's name never reaches a link unfurl or a non-member's tab.
 */
import type { PrismaClient } from "@prisma/client";
import { canReadGroupType } from "./access";

export const THINKTANKS_TITLE = "ThinkTanks - IxStates";

interface GroupTitleSource {
  name: string;
  isActive: boolean;
  type: string;
}

/** The group's name and section, or the section title for a missing, inactive or members-only group. */
export function thinktankGroupTitle(group: GroupTitleSource | null): string {
  if (!group?.isActive || !canReadGroupType(group.type)) return THINKTANKS_TITLE;
  return `${group.name} - ${THINKTANKS_TITLE}`;
}

export async function loadThinktankGroupTitle(
  db: Pick<PrismaClient, "thinktankGroup">,
  groupId: string
): Promise<string> {
  const group = await db.thinktankGroup.findUnique({
    where: { id: groupId },
    select: { name: true, isActive: true, type: true },
  });
  return thinktankGroupTitle(group);
}
