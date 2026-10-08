/**
 * Account-level privacy switches that shape the public passport (Settings → Privacy & Security,
 * SL-4), on top of the passport's own section toggles (identity.privacy.ts):
 *
 * - `showWikiAttribution` off: other viewers see no wiki name, Lorewards or award
 *   history, and the Work tab lists no wiki articles or wiki activity.
 * - `showOnlineStatus`: whether the passport shows the holder as online (presence.ts).
 * - `searchEngineIndexing` off: the passport page sets `robots: noindex, nofollow`
 *   (`src/app/id/[username]/layout.tsx`; `/@handle` rewrites there).
 *
 * The passport shows no Discord affiliation, so `showDiscordTag` does not apply here. The owner
 * always sees their own names. A read error hides the names (fails closed).
 */
import { db } from "~/server/db";
import { usersWithSwitchOff } from "~/server/shared/privacy-permissions";
import { visibleOnlineUserIds } from "~/server/shared/presence";
import { resolveHandleOwnerClerkId } from "./identity.resolve";
import type { ResolvedIdentity } from "./identity.types";

export interface PassportLinkPrivacy {
  hideWiki: boolean;
}

export async function loadLinkPrivacy(identity: ResolvedIdentity): Promise<PassportLinkPrivacy> {
  const clerkId = identity.user?.clerkUserId;
  if (!clerkId || identity.isOwner) return { hideWiki: false };
  try {
    const wikiOff = await usersWithSwitchOff(db, [clerkId], "showWikiAttribution");
    return { hideWiki: wikiOff.has(clerkId) };
  } catch {
    return { hideWiki: true };
  }
}

/**
 * Whether search engines may index the passport at `handle` (`searchEngineIndexing`). A handle
 * with no user (an external wiki or forum name) is indexable; a read error is not.
 */
export async function passportIndexable(handle: string): Promise<boolean> {
  try {
    const clerkId = await resolveHandleOwnerClerkId(handle);
    if (!clerkId) return true;
    return !(await usersWithSwitchOff(db, [clerkId], "searchEngineIndexing")).has(clerkId);
  } catch {
    return false;
  }
}

/** Whether the passport holder is online and lets others see it. */
export async function passportOnline(identity: ResolvedIdentity): Promise<boolean> {
  const clerkId = identity.user?.clerkUserId;
  if (!clerkId) return false;
  return (await visibleOnlineUserIds(db, [clerkId])).has(clerkId);
}
