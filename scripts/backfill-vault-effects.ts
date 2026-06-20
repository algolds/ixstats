/**
 * One-off backfill: populate `VaultStoreItem.effects` for items that have none.
 *
 * Why: items created via the admin UI got `effects = null`, so cosmetics rendered
 * nothing and the passive yield boost summed to 0 (see project_vault_cosmetics_architecture).
 * The canonical string-id items (cosmetic_gold_glow, upgrade_yield_boost, ...) get their
 * exact catalog effects; admin-created cuid items are inferred from name/badge/category.
 *
 * Usage:
 *   bun run scripts/backfill-vault-effects.ts            # dry run — prints planned changes
 *   bun run scripts/backfill-vault-effects.ts --apply    # actually write
 *
 * Idempotent: items that already have a non-empty `effects` are skipped.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Exact effects for the canonical catalog ids (matches src/lib/cosmetics.ts + the
// original scratch-backfill-effects.ts).
const CANONICAL: Record<string, any> = {
  cosmetic_gold_glow: {
    customizations: { avatarGlow: { enabled: true, color: "rgba(245,158,11,0.65)", intensity: "15px" } },
  },
  cosmetic_neon_frame: {
    customizations: { neonFrame: { enabled: true, color: "#22d3ee", style: "pulse" } },
  },
  cosmetic_chat_badge: {
    customizations: { chatBadge: { enabled: true, icon: "Crown", color: "#f59e0b" } },
  },
  upgrade_yield_boost: { perks: { yieldBoost: 0.05 } },
  upgrade_card_capacity: { perks: { cardCapacity: 50 } },
  upgrade_lore_token: { perks: { loreTokens: 1 } },
};

function hasEffects(effects: unknown): boolean {
  return !!effects && typeof effects === "object" && Object.keys(effects as object).length > 0;
}

/** Infer effects for an admin-created item from its text + category. */
function infer(item: { name: string; badgeText: string | null; category: string; glowColor: string | null }): any | null {
  const text = `${item.name} ${item.badgeText ?? ""}`.toLowerCase();

  if (item.category === "upgrades") {
    const perks: Record<string, number> = {};
    if (/(yield|income|dividend|boost|interest)/.test(text)) perks.yieldBoost = 0.05;
    if (/(card|capacity|slot)/.test(text)) perks.cardCapacity = 50;
    if (/(lore|token)/.test(text)) perks.loreTokens = 1;
    // Fallback: an upgrade with no recognizable perk still gets a small yield boost
    // so it isn't completely inert — adjust per item in the admin UI afterward.
    if (Object.keys(perks).length === 0) perks.yieldBoost = 0.05;
    return { perks };
  }

  // cosmetics
  const color = item.glowColor || "#f59e0b";
  if (/(badge|crown|chat|rank|elite|vip)/.test(text)) {
    return { customizations: { chatBadge: { enabled: true, icon: "Crown", color } } };
  }
  if (/(neon|frame|border|cyber|outline)/.test(text)) {
    return { customizations: { neonFrame: { enabled: true, color, style: "pulse" } } };
  }
  // default cosmetic: avatar glow (covers "glow", "gold", "aura", "shine", etc.)
  return { customizations: { avatarGlow: { enabled: true, color, intensity: "15px" } } };
}

async function main() {
  const items = await prisma.vaultStoreItem.findMany();
  console.log(`Found ${items.length} store items. Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  let skipped = 0;
  let planned = 0;

  for (const item of items) {
    if (hasEffects(item.effects)) {
      skipped++;
      continue;
    }

    const effects = CANONICAL[item.id] ?? infer(item);
    if (!effects) {
      console.log(`?  ${item.id} "${item.name}" (${item.category}) — could not infer, skipping`);
      continue;
    }

    planned++;
    console.log(`→  ${item.id} "${item.name}" (${item.category}) => ${JSON.stringify(effects)}`);

    if (APPLY) {
      await prisma.vaultStoreItem.update({ where: { id: item.id }, data: { effects } });
    }
  }

  console.log(
    `\nDone. ${planned} item(s) ${APPLY ? "updated" : "to update"}, ${skipped} already had effects.`
  );
  if (!APPLY && planned > 0) console.log("Re-run with --apply to write these changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
