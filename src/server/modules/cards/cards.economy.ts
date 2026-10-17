/**
 * The Economy tab: the card numbers an admin tunes, all SystemConfig-backed. Card values (rarity floors and type
 * multipliers; saving revalues every card), the market fee and base capacity, the bonuses with the Loreward payout
 * grid, each source wiki's rarity table, and each article wiki's daily import. Each save checks its numbers here, so
 * a refusal reaches the admin as a sentence, and writes one audit row in the transaction that writes the numbers.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  cardSourceLabel,
  type CardArticleSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import {
  BONUS_FIELDS,
  BONUS_SWITCH_FIELD,
  CARD_VALUE_FIELDS,
  MARKET_FIELDS,
  dailyImportCountField,
  floorsProblem,
  lorewardPayoutField,
  numberFieldProblem,
  type EconomyNumberField,
} from "~/lib/cards/economy-fields";
import {
  clearGeneralCardSettingsCache,
  getGeneralCardSettings,
  setGeneralCardSetting,
  type CardGeneralSettings,
} from "~/lib/cards/general-settings";
import {
  RarityThresholdsSchema,
  TIERED_RARITIES,
  type RarityThresholds,
} from "~/lib/cards/rarity-engine";
import {
  clearValuationCache,
  getValuationConfig,
  readValuationConfig,
  recomputeAllCardValues,
  setValuationConfig,
  type CardValuationConfig,
} from "~/lib/cards/valuation";
import {
  clearBonusConfigCache,
  getBonusConfig,
  getLorewardPayouts,
  setBonusConfig,
  setLorewardPayout,
  type LorewardPlace,
  type LorewardType,
  type VaultBonusConfig,
} from "~/lib/vault/vault-bonus";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";
import {
  getDailyImportConfig,
  getRarityThresholds,
  setDailyImportSetting,
  setRarityThresholds,
  type DailyImportSetting,
} from "./cards.config";

type Tx = Prisma.TransactionClient;

export async function economySettings(db: PrismaClient) {
  const [values, market, bonuses, lorewardPayouts, rarityThresholds, dailyImports] =
    await Promise.all([
      getValuationConfig(db),
      getGeneralCardSettings(db),
      getBonusConfig(db),
      getLorewardPayouts(db),
      getRarityThresholds(db),
      getDailyImportConfig(db),
    ]);
  return { values, market, bonuses, lorewardPayouts, rarityThresholds, dailyImports };
}

function refuse(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/**
 * Runs `write` and the audit row for `details` in one transaction, then `clear`s the section's cache. The clear waits
 * for the commit: a read before it would cache the old values again.
 */
async function saveAudited(
  db: PrismaClient,
  actor: CardAdminActor,
  details: string,
  write: (tx: Tx) => Promise<void>,
  clear?: () => void
): Promise<void> {
  await db.$transaction(async (tx) => {
    await write(tx);
    await recordCardAudit(tx, { action: "CARD_ECONOMY_SAVE", actor: actor.clerkId, details });
  });
  clear?.();
}

interface FieldSave<K extends string> {
  write: (tx: Tx, key: K, value: number) => Promise<void>;
  /** Clears the section's cache once the save commits. */
  clear: () => void;
  /** Refuses the sent fields against the stored ones, inside the transaction and before any write. */
  check?: (tx: Tx, sent: ReadonlyArray<[K, number]>) => Promise<void>;
}

/**
 * Saves the fields of a section that `input` sent, after checking every one against its bounds. A save that sent no
 * field writes nothing; returns whether anything was written.
 */
async function saveFields<K extends string>(
  db: PrismaClient,
  actor: CardAdminActor,
  section: string,
  fields: ReadonlyArray<EconomyNumberField<K>>,
  input: Partial<Record<K, number>>,
  save: FieldSave<K>
): Promise<boolean> {
  const sent: Array<[K, number]> = [];
  for (const field of fields) {
    const value = input[field.key];
    if (value === undefined) continue;
    const problem = numberFieldProblem(field, value);
    if (problem) refuse(problem);
    sent.push([field.key, value]);
  }
  if (sent.length === 0) return false;
  const details = `${section}: ${sent.map(([key, value]) => `${key} ${value}`).join(", ")}`;
  const write = async (tx: Tx) => {
    await save.check?.(tx, sent);
    for (const [key, value] of sent) await save.write(tx, key, value);
  };
  await saveAudited(db, actor, details, write, save.clear);
  return true;
}

/** Refuses floors that would not rise with rarity once the sent values replace the stored ones. */
async function checkFloors(
  tx: Tx,
  sent: ReadonlyArray<[keyof CardValuationConfig, number]>
): Promise<void> {
  const problem = floorsProblem({
    ...(await readValuationConfig(tx)),
    ...Object.fromEntries(sent),
  });
  if (problem) refuse(problem);
}

/**
 * Saves the sent card values, then revalues every card. The revalue runs after the commit in its own transaction, as
 * an update of every card is too long for the save's. A failed revalue keeps the saved values and returns a null
 * count, so the admin is told to revalue again rather than that nothing saved.
 */
export async function saveCardValues(
  db: PrismaClient,
  actor: CardAdminActor,
  input: Partial<CardValuationConfig>
): Promise<{ updated: number | null }> {
  const saved = await saveFields(db, actor, "Card values", CARD_VALUE_FIELDS, input, {
    write: setValuationConfig,
    clear: clearValuationCache,
    check: checkFloors,
  });
  if (!saved) return { updated: 0 };
  try {
    return await recomputeAllCardValues(db);
  } catch (error) {
    console.error("[cards.economy] Revalue after a card values save failed:", error);
    return { updated: null };
  }
}

/** Revalues every card. A failed audit row after a revalue that ran is logged, so the admin is not told it failed. */
export async function recomputeValues(
  db: PrismaClient,
  actor: CardAdminActor
): Promise<{ updated: number }> {
  const result = await recomputeAllCardValues(db);
  try {
    await recordCardAudit(db, {
      action: "CARD_ECONOMY_SAVE",
      actor: actor.clerkId,
      details: `Revalued every card, ${result.updated.toLocaleString("en-US")} changed value`,
    });
  } catch (error) {
    console.error("[cards.economy] The audit row for a revalue failed:", error);
  }
  return result;
}

export async function saveMarket(
  db: PrismaClient,
  actor: CardAdminActor,
  input: Partial<CardGeneralSettings>
): Promise<void> {
  await saveFields(db, actor, "Market", MARKET_FIELDS, input, {
    write: setGeneralCardSetting,
    clear: clearGeneralCardSettingsCache,
  });
}

const BONUS_SAVE_FIELDS: ReadonlyArray<EconomyNumberField<keyof VaultBonusConfig>> = [
  BONUS_SWITCH_FIELD,
  ...BONUS_FIELDS,
];

export async function saveBonuses(
  db: PrismaClient,
  actor: CardAdminActor,
  input: Partial<VaultBonusConfig>
): Promise<void> {
  await saveFields(db, actor, "Bonuses", BONUS_SAVE_FIELDS, input, {
    write: setBonusConfig,
    clear: clearBonusConfigCache,
  });
}

export async function saveLorewardPayouts(
  db: PrismaClient,
  actor: CardAdminActor,
  cells: ReadonlyArray<{ type: LorewardType; place: LorewardPlace; credits: number }>
): Promise<void> {
  const seen = new Set<string>();
  for (const cell of cells) {
    const field = lorewardPayoutField(cell.type, cell.place);
    const problem = numberFieldProblem(field, cell.credits);
    if (problem) refuse(problem);
    if (seen.has(field.key)) refuse(`${field.label} is listed twice.`);
    seen.add(field.key);
  }
  if (cells.length === 0) return;
  const details = `Loreward payouts: ${cells
    .map((cell) => `${cell.type} ${cell.place} ${cell.credits}`)
    .join(", ")}`;
  await saveAudited(db, actor, details, async (tx) => {
    for (const cell of cells) await setLorewardPayout(tx, cell.type, cell.place, cell.credits);
  });
}

export async function saveRarityThresholds(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { source: CardWikiSource; thresholds: RarityThresholds }
): Promise<void> {
  const check = RarityThresholdsSchema.safeParse(input.thresholds);
  if (!check.success) refuse(check.error.issues[0]?.message ?? "This rarity table cannot be saved");
  const table = TIERED_RARITIES.map((rarity) => `${rarity} ${check.data[rarity]}`).join(", ");
  await saveAudited(db, actor, `Rarity table: ${input.source} ${table}`, (tx) =>
    setRarityThresholds(tx, input.source, check.data)
  );
}

export async function saveDailyImport(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { source: CardArticleSource; setting: DailyImportSetting }
): Promise<void> {
  const { source, setting } = input;
  const problem = numberFieldProblem(dailyImportCountField(cardSourceLabel(source)), setting.count);
  if (problem) refuse(problem);
  const state = setting.enabled ? `on, ${setting.count} a day` : "off";
  await saveAudited(db, actor, `Daily import: ${source} ${state}`, (tx) =>
    setDailyImportSetting(tx, source, setting)
  );
}
