/**
 * Public equipped cosmetics (VT-12): what another player sees of someone's equipped Vault
 * cosmetics. Only render data leaves the server (the equipped cosmetic ids and their resolved
 * glow / badge / frame), never the wallet, purchases or inventory.
 *
 * Equipping a cosmetic is the owner's choice to show it; there is no separate visibility setting.
 * The resolution mirrors `useActiveCosmetics` (the owner's own view): the canonical catalog in
 * `~/lib/media/cosmetics` first, the store item's `effects.customizations` as the fallback, and
 * only active `cosmetics` store items count.
 */
import { getCosmeticEffects } from "~/lib/media/cosmetics";

/** Most users one lookup may name (per key kind), so a list page costs one bounded query. */
export const MAX_PUBLIC_COSMETICS_LOOKUP = 50;

export interface AvatarGlowDisplay {
  enabled: boolean;
  color: string;
  intensity: string;
  style?: string;
}

export interface ChatBadgeDisplay {
  enabled: boolean;
  icon: string;
  color: string;
}

export interface NeonFrameDisplay {
  enabled: boolean;
  color: string;
  style?: string;
}

export interface PublicCosmetics {
  /** Equipped cosmetic store item ids that resolved to an effect, in equip order. */
  equipped: string[];
  avatarGlow: AvatarGlowDisplay;
  chatBadge: ChatBadgeDisplay;
  neonFrame: NeonFrameDisplay;
}

export function noPublicCosmetics(): PublicCosmetics {
  return {
    equipped: [],
    avatarGlow: { enabled: false, color: "rgba(245,158,11,0.65)", intensity: "15px" },
    chatBadge: { enabled: false, icon: "Crown", color: "#f59e0b" },
    neonFrame: { enabled: false, color: "#22d3ee", style: "pulse" },
  };
}

/** `MyVault.equippedCosmetics` is a comma-separated id list. */
export function parseEquippedCosmetics(raw: string | null | undefined): string[] {
  return raw ? raw.split(",").filter(Boolean) : [];
}

type Customizations = {
  avatarGlow?: Partial<AvatarGlowDisplay>;
  chatBadge?: Partial<ChatBadgeDisplay>;
  neonFrame?: Partial<NeonFrameDisplay>;
};

function customizationsOf(itemId: string, dbEffects: unknown): Customizations | null {
  const catalog = getCosmeticEffects(itemId);
  if (catalog) return catalog;
  if (dbEffects && typeof dbEffects === "object" && "customizations" in dbEffects) {
    const custom = (dbEffects as { customizations?: unknown }).customizations;
    if (custom && typeof custom === "object") return custom as Customizations;
  }
  return null;
}

/**
 * Resolve equipped ids into render data. `activeCosmetics` maps each active `cosmetics` store
 * item id to its stored `effects`; an equipped id missing from it (retired, deactivated or not a
 * cosmetic) is ignored.
 */
export function resolvePublicCosmetics(
  equipped: readonly string[],
  activeCosmetics: ReadonlyMap<string, unknown>
): PublicCosmetics {
  const out = noPublicCosmetics();
  for (const id of equipped) {
    if (!activeCosmetics.has(id) || out.equipped.includes(id)) continue;
    const custom = customizationsOf(id, activeCosmetics.get(id));
    if (!custom) continue;
    let applied = false;
    if (custom.avatarGlow?.enabled) {
      out.avatarGlow = {
        enabled: true,
        color: custom.avatarGlow.color || out.avatarGlow.color,
        intensity: custom.avatarGlow.intensity || out.avatarGlow.intensity,
        style: custom.avatarGlow.style || out.avatarGlow.style,
      };
      applied = true;
    }
    if (custom.chatBadge?.enabled) {
      out.chatBadge = {
        enabled: true,
        icon: custom.chatBadge.icon || out.chatBadge.icon,
        color: custom.chatBadge.color || out.chatBadge.color,
      };
      applied = true;
    }
    if (custom.neonFrame?.enabled) {
      out.neonFrame = {
        enabled: true,
        color: custom.neonFrame.color || out.neonFrame.color,
        style: custom.neonFrame.style || out.neonFrame.style,
      };
      applied = true;
    }
    if (applied) out.equipped.push(id);
  }
  return out;
}

interface PublicCosmeticsDb {
  user: {
    findMany(args: {
      where: object;
      select: {
        id: true;
        clerkUserId: true;
        vault: { select: { equippedCosmetics: true } };
      };
    }): Promise<
      Array<{
        id: string;
        clerkUserId: string;
        vault: { equippedCosmetics: string | null } | null;
      }>
    >;
  };
  vaultStoreItem: {
    findMany(args: {
      where: object;
      select: { id: true; effects: true };
    }): Promise<Array<{ id: string; effects: unknown }>>;
  };
}

export interface PublicCosmeticsLookup {
  /** Internal `User.id` or Clerk id, as the call site has it. */
  userIds?: readonly string[];
}

export interface PublicCosmeticsResult {
  /** Keyed by the id exactly as requested; users with nothing equipped are left out. */
  users: Record<string, PublicCosmetics>;
}

/**
 * Load the public cosmetics of up to `MAX_PUBLIC_COSMETICS_LOOKUP` users in two queries (users with
 * their vault, then the store items they have equipped).
 */
export async function loadPublicCosmetics(
  db: PublicCosmeticsDb,
  lookup: PublicCosmeticsLookup
): Promise<PublicCosmeticsResult> {
  const userIds = [...new Set(lookup.userIds ?? [])].slice(0, MAX_PUBLIC_COSMETICS_LOOKUP);
  const result: PublicCosmeticsResult = { users: {} };
  if (userIds.length === 0) return result;

  const users = await db.user.findMany({
    where: { isActive: true, OR: [{ id: { in: userIds } }, { clerkUserId: { in: userIds } }] },
    select: {
      id: true,
      clerkUserId: true,
      vault: { select: { equippedCosmetics: true } },
    },
  });

  const equippedByUser = new Map(
    users.map((user) => [user.id, parseEquippedCosmetics(user.vault?.equippedCosmetics)])
  );
  const allEquipped = [...new Set([...equippedByUser.values()].flat())];
  if (allEquipped.length === 0) return result;

  const items = await db.vaultStoreItem.findMany({
    where: { id: { in: allEquipped }, category: "cosmetics", isActive: true },
    select: { id: true, effects: true },
  });
  const activeCosmetics = new Map(items.map((item) => [item.id, item.effects]));

  const wantedUserIds = new Set(userIds);
  for (const user of users) {
    const cosmetics = resolvePublicCosmetics(equippedByUser.get(user.id) ?? [], activeCosmetics);
    if (cosmetics.equipped.length === 0) continue;
    for (const key of [user.id, user.clerkUserId]) {
      if (wantedUserIds.has(key)) result.users[key] = cosmetics;
    }
  }
  return result;
}
