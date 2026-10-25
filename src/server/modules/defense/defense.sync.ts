/**
 * Bring a nation's defense up to date on its realm clock (realm time design §4.2): load the policy, branches, orders
 * and assets; give a nation without a policy its starter force (players at the reset, NPCs on first touch); advance
 * the whole months since the last tick; persist with a compare-and-set on the policy's `lastTickClockMs`, so two
 * readers never apply the same months twice.
 */
import type { MilitaryBranch, Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  DOMAIN_PARAMS,
  OPERATION_WEAR,
  advanceNation,
  deriveNation,
  npcPolicy,
  starterBranchName,
  starterBranchSpecs,
  starterNation,
  type AssetState,
  type BranchDomain,
  type Delivery,
  type DefenseBudgetSource,
  type EconomyInputs,
  type NationState,
  type NationView,
  type StarterBranchSpec,
} from "~/lib/military/model";
import { clockForCountry, type RealmClockReader } from "~/server/shared/realm-time";
import { feedbackSuppressed, syncDefenseFeedback } from "./defense.feedback";
import { DEFENSE_COUNTRY_SELECT, loadEconomy, type DefenseCountry } from "./defense.economy";
import {
  assetState,
  branchData,
  branchState,
  eraDesignYear,
  orderState,
  policyData,
  policyState,
} from "./defense.mapping";

type Tx = Prisma.TransactionClient;
/** The client or a transaction: the reset script runs every nation inside one rolled-back transaction. */
export type DefenseDb = Prisma.TransactionClient;

/** Run `fn` in a transaction, or in the one `db` already is. */
export async function withTx<T>(db: DefenseDb, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = db as DefenseDb & Partial<Pick<PrismaClient, "$transaction">>;
  return client.$transaction ? client.$transaction(fn) : fn(db);
}

/** Effort a branch of a domain without a starter share gets at the reset (designer). */
const EXTRA_DOMAIN_EFFORT: Record<BranchDomain, number> = {
  land: 0.55,
  sea: 0.25,
  air: 0.2,
  marines: 0.1,
  space: 0.05,
  strategic_missile: 0.05,
};

export interface DefenseSnapshot {
  country: DefenseCountry;
  clock: RealmClockReader;
  nowClockMs: number;
  econ: EconomyInputs;
  budgetSource: DefenseBudgetSource;
  state: NationState;
  /** The branch rows as read (identity fields: name, motto, image; numbers are in `state` and `view`). */
  branchRows: MilitaryBranch[];
  assets: AssetState[];
  view: NationView;
  /** Months this read applied. */
  monthsApplied: number;
}

async function loadCountry(db: DefenseDb, countryId: string): Promise<DefenseCountry> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: DEFENSE_COUNTRY_SELECT,
  });
  if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
  return country;
}

/** Wear per branch from operations under way: the heaviest operation any of its units or assets is deployed on. */
async function operationWear(db: DefenseDb, countryId: string, branchIds: string[]) {
  const wear = new Map<string, number>(branchIds.map((id) => [id, 1]));
  const deployments = await db.deployment.findMany({
    where: { status: "deployed", operation: { countryId, status: "active" } },
    select: { unitId: true, assetId: true, operation: { select: { operationType: true } } },
  });
  if (deployments.length === 0) return wear;
  const [units, assets] = await Promise.all([
    db.militaryUnit.findMany({
      where: { id: { in: deployments.flatMap((d) => (d.unitId ? [d.unitId] : [])) } },
      select: { id: true, branchId: true },
    }),
    db.militaryAsset.findMany({
      where: { id: { in: deployments.flatMap((d) => (d.assetId ? [d.assetId] : [])) } },
      select: { id: true, branchId: true },
    }),
  ]);
  const branchOf = new Map([...units, ...assets].map((row) => [row.id, row.branchId]));
  for (const d of deployments) {
    const branchId = branchOf.get(d.unitId ?? d.assetId ?? "");
    if (!branchId || !wear.has(branchId)) continue;
    const w = OPERATION_WEAR[d.operation.operationType] ?? 1;
    wear.set(branchId, Math.max(wear.get(branchId)!, w));
  }
  return wear;
}

async function loadAssets(db: DefenseDb, countryId: string): Promise<AssetState[]> {
  const rows = await db.militaryAsset.findMany({
    where: { branch: { countryId, isActive: true } },
    select: { branchId: true, catalogKey: true, quantity: true, acquisitionCost: true, designYear: true },
  });
  const keys = [...new Set(rows.flatMap((r) => (r.catalogKey ? [r.catalogKey] : [])))];
  const catalog = keys.length
    ? await db.militaryEquipmentCatalog.findMany({
        where: { key: { in: keys } },
        select: {
          key: true,
          subcategory: true,
          capabilities: true,
          crewRequirement: true,
          acquisitionCost: true,
          era: true,
        },
      })
    : [];
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  return rows.map((row) => assetState(row, row.catalogKey ? byKey.get(row.catalogKey) : undefined));
}

/** The starter branch specs for a nation: its existing branches (identities kept) or army, navy and air force. */
function starterSpecs(branches: readonly MilitaryBranch[]): StarterBranchSpec[] {
  if (branches.length === 0) return starterBranchSpecs();
  return branches.map((b) => ({
    id: b.id,
    domain: b.domain,
    effortShare: DOMAIN_PARAMS[b.domain].starterEffort || EXTRA_DOMAIN_EFFORT[b.domain],
  }));
}

/**
 * Give a nation without a policy its starter force: the equilibrium of its budget (NPCs with their government
 * form's manpower model). Existing branches keep their names, units and images; their numbers are reset. A
 * concurrent creator wins the unique policy row and this call returns false.
 */
export async function ensureStarterForce(
  db: DefenseDb,
  country: DefenseCountry,
  econ: EconomyInputs,
  clockMs: number
): Promise<boolean> {
  const existing = await db.militaryBranch.findMany({
    where: { countryId: country.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const specs = starterSpecs(existing);
  const starter = starterNation({
    econ,
    clockMs,
    policy: country.ownerUserId === null ? npcPolicy(country.governmentType) : {},
    branches: specs,
  });
  const view = deriveNation(starter, econ, [], clockMs);
  try {
    await withTx(db, async (tx) => {
      await tx.defensePolicy.create({
        data: { countryId: country.id, ...policyData(starter.policy, clockMs) },
      });
      for (const [i, branch] of starter.branches.entries()) {
        const data = {
          ...branchData(branch, view.branches[i], clockMs),
          effortShare: branch.effortShare,
          targetActive: null,
        };
        if (existing.length > 0) {
          await tx.militaryBranch.update({ where: { id: branch.id }, data });
        } else {
          await tx.militaryBranch.create({
            data: {
              countryId: country.id,
              domain: branch.domain,
              name: starterBranchName(branch.domain),
              ...data,
            },
          });
        }
      }
    });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return false;
    throw error;
  }
}

async function readState(db: DefenseDb, countryId: string) {
  const [policy, branches, orders] = await Promise.all([
    db.defensePolicy.findUnique({ where: { countryId } }),
    db.militaryBranch.findMany({
      where: { countryId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    db.procurementOrder.findMany({ where: { countryId, status: "ordered" } }),
  ]);
  return { policy, branches, orders };
}

/** Asset rows for delivered orders: added to the branch's row for that catalog item, or a new row. */
async function recordDeliveries(tx: Tx, deliveries: readonly Delivery[]) {
  if (deliveries.length === 0) return;
  const catalog = await tx.militaryEquipmentCatalog.findMany({
    where: { key: { in: [...new Set(deliveries.map((d) => d.catalogKey))] } },
  });
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  for (const d of deliveries) {
    await tx.procurementOrder.update({
      where: { id: d.orderId },
      data: { status: "delivered", deliveredClockMs: d.deliveredClockMs },
    });
    const item = byKey.get(d.catalogKey);
    const existing = await tx.militaryAsset.findFirst({
      where: { branchId: d.branchId, catalogKey: d.catalogKey, designYear: d.designYear },
      select: { id: true },
    });
    if (existing) {
      await tx.militaryAsset.update({
        where: { id: existing.id },
        data: { quantity: { increment: d.quantity }, operational: { increment: d.quantity } },
      });
      continue;
    }
    await tx.militaryAsset.create({
      data: {
        branchId: d.branchId,
        name: item?.name ?? d.catalogKey,
        assetType: assetTypeForCategory(item?.category),
        category: item?.subcategory ?? item?.category ?? "equipment",
        quantity: d.quantity,
        operational: d.quantity,
        acquisitionCost: d.unitRealValue,
        maintenanceCost: item?.maintenanceCost ?? 0,
        catalogKey: d.catalogKey,
        designYear: d.designYear || eraDesignYear(item?.era),
        imageUrl: item?.imageUrl ?? null,
      },
    });
  }
}

const ASSET_TYPE_BY_CATEGORY = {
  aircraft: "aircraft",
  naval: "ship",
  vehicle: "vehicle",
  missile: "weapon_system",
  support: "installation",
} as const;

export const assetTypeForCategory = (category: string | null | undefined) =>
  ASSET_TYPE_BY_CATEGORY[(category ?? "") as keyof typeof ASSET_TYPE_BY_CATEGORY] ??
  "weapon_system";

class StaleTick extends Error {}

/** Persist an advance: CAS on the policy's tick, then branches, orders and deliveries. */
async function persistAdvance(
  db: DefenseDb,
  input: {
    policyId: string;
    previousTickMs: number;
    state: NationState;
    view: NationView;
    deliveries: Delivery[];
  }
) {
  const { state, view } = input;
  await withTx(db, async (tx) => {
    const claimed = await tx.defensePolicy.updateMany({
      where: { id: input.policyId, lastTickClockMs: input.previousTickMs },
      data: policyData(state.policy, state.lastTickClockMs),
    });
    if (claimed.count === 0) throw new StaleTick();
    for (const [i, branch] of state.branches.entries()) {
      await tx.militaryBranch.update({
        where: { id: branch.id },
        data: branchData(branch, view.branches[i], state.lastTickClockMs),
      });
    }
    const delivered = new Set(input.deliveries.map((d) => d.orderId));
    for (const order of state.orders) {
      if (order.status !== "ordered" || delivered.has(order.id)) continue;
      await tx.procurementOrder.update({
        where: { id: order.id },
        data: {
          paidSoFar: order.paidSoFar,
          unitCost: order.unitCost,
          expectedClockMs: order.expectedClockMs,
        },
      });
    }
    await recordDeliveries(tx, input.deliveries);
  });
}

/**
 * The nation's defense now: ensured, advanced to its realm clock and persisted. A paused realm's clock does not
 * move, so nothing ticks. Retries once when another reader advanced the same months first.
 */
export async function syncDefense(
  db: DefenseDb,
  countryId: string,
  attempt = 0
): Promise<DefenseSnapshot> {
  const country = await loadCountry(db, countryId);
  const clock = await clockForCountry(db, country);
  const nowClockMs = clock.now();
  const { econ, budgetSource } = await loadEconomy(db, country, clock);
  let { policy, branches, orders } = await readState(db, countryId);
  if (!policy) {
    await ensureStarterForce(db, country, econ, nowClockMs);
    ({ policy, branches, orders } = await readState(db, countryId));
    if (!policy) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No defense policy" });
  }
  const [wear, assets] = await Promise.all([
    operationWear(
      db,
      countryId,
      branches.map((b) => b.id)
    ),
    loadAssets(db, countryId),
  ]);
  const state: NationState = {
    policy: policyState(policy),
    branches: branches.map((b) => branchState(b, wear.get(b.id) ?? 1)),
    orders: orders.map(orderState),
    lastTickClockMs: policy.lastTickClockMs,
  };
  const advanced = advanceNation(state, econ, nowClockMs);
  const view = deriveNation(advanced.state, econ, assets, nowClockMs);
  if (advanced.months > 0) {
    try {
      await persistAdvance(db, {
        policyId: policy.id,
        previousTickMs: policy.lastTickClockMs,
        state: advanced.state,
        view,
        deliveries: advanced.deliveries,
      });
    } catch (error) {
      if (error instanceof StaleTick && attempt === 0) return syncDefense(db, countryId, 1);
      throw error;
    }
  }
  // Deliveries became asset rows: read them back so quality and enablers count the new kit.
  const finalAssets = advanced.deliveries.length > 0 ? await loadAssets(db, countryId) : assets;
  const snapshot: DefenseSnapshot = {
    country,
    clock,
    nowClockMs,
    econ,
    budgetSource,
    state: advanced.state,
    branchRows: branches,
    assets: finalAssets,
    view: finalAssets === assets ? view : deriveNation(advanced.state, econ, finalAssets, nowClockMs),
    monthsApplied: advanced.months,
  };
  if (advanced.months > 0 && !feedbackSuppressed()) {
    // D3: the economy feels the defense posture once per in-game month (idempotent keyed levels).
    await syncDefenseFeedback(db, snapshot, policy.lastTickClockMs, syncDefense).catch((error) =>
      console.error(`[defense] Economic feedback failed for ${countryId}`, error)
    );
  }
  return snapshot;
}

/** Combat power of several nations now (each synced; NPCs get their forces on first touch). */
export async function nationalCombatPower(
  db: DefenseDb,
  countryIds: readonly string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(countryIds)];
  const entries = await Promise.all(
    unique.map(async (id) => {
      try {
        return [id, (await syncDefense(db, id)).view.combatPower] as const;
      } catch (error) {
        console.error(`[defense] Could not read the forces of ${id}`, error);
        return [id, 0] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}
