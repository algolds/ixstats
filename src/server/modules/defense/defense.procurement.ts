/**
 * Procurement orders (owner decision: domestic within industrial capacity, catalog imports at +15% and longer lead
 * times). An order pays 15% down then evenly over its lead time from the procurement line; it delivers into the
 * branch's capital and assets on the realm clock (`defense.sync`).
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  MONTH_MS,
  capacityDraw,
  domesticCapacity,
  leadMonths,
  orderUnitCost,
  type BranchDomain,
  type OrderSource,
} from "~/lib/military/model";
import { eraDesignYear } from "./defense.mapping";
import { syncDefense } from "./defense.sync";

/** Most open orders a nation may hold, and units per order. */
export const MAX_OPEN_ORDERS = 100;
export const MAX_ORDER_QUANTITY = 10_000;

/** Which branch domains may hold a catalog category. */
const DOMAINS_BY_CATEGORY: Record<string, readonly BranchDomain[]> = {
  aircraft: ["air", "sea", "land", "marines"],
  naval: ["sea", "marines"],
  vehicle: ["land", "marines"],
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function assertFits(input: {
  domain: BranchDomain;
  category: string;
  name: string;
}) {
  const allowed = DOMAINS_BY_CATEGORY[input.category];
  if (allowed && !allowed.includes(input.domain)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${input.name} cannot serve in a ${input.domain.replace("_", " ")} branch.`,
    });
  }
}

/** Order catalog equipment for a branch. */
export async function orderProcurement(
  db: PrismaClient,
  input: {
    countryId: string;
    branchId: string;
    catalogKey: string;
    quantity: number;
    source: OrderSource;
  }
) {
  const snapshot = await syncDefense(db, input.countryId);
  const branch = snapshot.state.branches.find((b) => b.id === input.branchId);
  if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
  const item = await db.militaryEquipmentCatalog.findUnique({ where: { key: input.catalogKey } });
  if (!item || !item.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Catalog item not found" });
  }
  assertFits({ domain: branch.domain, category: item.category, name: item.name });
  const open = snapshot.state.orders.filter((o) => o.status === "ordered");
  if (open.length >= MAX_OPEN_ORDERS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A nation can hold at most ${MAX_OPEN_ORDERS} open orders.`,
    });
  }

  const { policy } = snapshot.state;
  const now = snapshot.nowClockMs;
  const surging = policy.surgeStartedClockMs !== null;
  const designYear = eraDesignYear(item.era);
  const lead = leadMonths(item.subcategory, input.source);
  const unitCost = orderUnitCost({
    catalogCost: item.acquisitionCost,
    priceIndex: policy.priceIndex,
    source: input.source,
    surging,
  });

  if (input.source === "domestic") {
    const accessible = snapshot.econ.frontierYear - snapshot.view.frontierLagYears;
    if (designYear > accessible) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${item.name} is beyond your industry's technology. Import it, or invest in R&D.`,
      });
    }
    const capacity = domesticCapacity({
      gdp: snapshot.econ.gdp,
      surgeMonths: surging ? (now - policy.surgeStartedClockMs!) / MONTH_MS : null,
      priceIndex: policy.priceIndex,
    });
    const used = open.reduce((sum, o) => sum + capacityDraw(o), 0);
    const draw = (unitCost * input.quantity) / lead;
    if (used + draw > capacity) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Domestic industry can take ${fmt(Math.max(0, capacity - used))} a month more; this order needs ${fmt(draw)}. Import it, order fewer, or surge production.`,
      });
    }
  }

  return db.procurementOrder.create({
    data: {
      countryId: input.countryId,
      branchId: branch.id,
      catalogKey: item.key,
      quantity: input.quantity,
      unitCost,
      unitRealValue: item.acquisitionCost,
      source: input.source,
      leadMonths: lead,
      designYear,
      orderedClockMs: now,
      expectedClockMs: now + lead * MONTH_MS,
    },
  });
}

/** Cancel an open order; what was paid is sunk. */
export async function cancelProcurementOrder(
  db: PrismaClient,
  input: { countryId: string; orderId: string }
) {
  await syncDefense(db, input.countryId);
  const cancelled = await db.procurementOrder.updateMany({
    where: { id: input.orderId, countryId: input.countryId, status: "ordered" },
    data: { status: "cancelled" },
  });
  if (cancelled.count === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only an open order can be cancelled." });
  }
  return { orderId: input.orderId, status: "cancelled" as const };
}

/** A nation's orders, newest first, with the catalog item's name. */
export async function listProcurementOrders(
  db: PrismaClient,
  input: { countryId: string; includeClosed?: boolean }
) {
  await syncDefense(db, input.countryId);
  const orders = await db.procurementOrder.findMany({
    where: {
      countryId: input.countryId,
      ...(input.includeClosed ? {} : { status: "ordered" as const }),
    },
    orderBy: { orderedClockMs: "desc" },
  });
  const catalog = await db.militaryEquipmentCatalog.findMany({
    where: { key: { in: [...new Set(orders.map((o) => o.catalogKey))] } },
    select: { key: true, name: true, imageUrl: true },
  });
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  return orders.map((o) => ({
    ...o,
    name: byKey.get(o.catalogKey)?.name ?? o.catalogKey,
    imageUrl: byKey.get(o.catalogKey)?.imageUrl ?? null,
    totalCost: o.unitCost * o.quantity,
  }));
}
