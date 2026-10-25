/**
 * A small in-memory stand-in for the Prisma models the defense module reads and writes, so the sync, CAS, starter
 * and lever paths run end to end without a database. Only the query shapes the module uses are supported.
 */
type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

function matchesCondition(value: unknown, cond: unknown): boolean {
  if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
    const c = cond as { in?: unknown[]; notIn?: unknown[]; not?: unknown; gt?: number; gte?: number };
    if (c.in) return c.in.includes(value);
    if (c.notIn) return !c.notIn.includes(value);
    if ("not" in c) return value !== c.not;
    if (c.gt !== undefined) return typeof value === "number" && value > c.gt;
    if (c.gte !== undefined) return typeof value === "number" && value >= c.gte;
  }
  return value === cond;
}

function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "branch" || key === "operation") return true; // relation filters: callers pre-scope rows
    if (key === "AND") return (cond as Where[]).every((w) => matches(row, w));
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));
    return matchesCondition(row[key], cond);
  });
}

/** Column defaults the schema would fill in. */
const DEFAULTS: Record<string, Record<string, unknown>> = {
  branch: {
    isActive: true,
    activeDuty: 0,
    reserves: 0,
    civilianStaff: 0,
    effortShare: 0,
    targetActive: null,
    capital: 0,
    readinessPersonnel: 0,
    readinessEquipment: 0,
    readinessCondition: 0,
    readinessTraining: 0,
    reserveTraining: 0,
    mobilisationOrder: 0,
    mobilisationOrderedClockMs: null,
    mobilised: 0,
    lastTickClockMs: 0,
    motto: null,
    imageUrl: null,
  },
  order: { status: "ordered", paidSoFar: 0, deliveredClockMs: null },
  asset: { status: "operational", unitId: null },
};

function table(prefix: string, rows: Row[]) {
  return {
    rows,
    findUnique: async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null,
    findFirst: async ({ where }: { where?: Where }) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: { where?: Where } = {}) => rows.filter((r) => matches(r, where)),
    count: async ({ where }: { where?: Where } = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (prefix === "policy" && rows.some((r) => r.countryId === data.countryId)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      const row: Row = { id: nextId(prefix), createdAt: new Date(seq), ...DEFAULTS[prefix], ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error(`${prefix} ${JSON.stringify(where)} not found`);
      for (const [key, value] of Object.entries(data)) {
        const inc = value as { increment?: number };
        row[key] =
          inc && typeof inc === "object" && "increment" in inc
            ? (row[key] as number) + inc.increment!
            : value;
      }
      return row;
    },
    createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
      for (const d of data) rows.push({ id: nextId(prefix), ...d });
      return { count: data.length };
    },
    updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    },
    delete: async ({ where }: { where: Where }) => {
      const i = rows.findIndex((r) => matches(r, where));
      return rows.splice(i, 1)[0];
    },
  };
}

export interface FakeCountry {
  id: string;
  name?: string;
  realmId?: string;
  ownerUserId?: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp?: number;
  governmentType?: string | null;
  region?: string | null;
  totalGovernmentSpending?: number | null;
}

export function fakeDefenseDb(countries: FakeCountry[]) {
  const countryRows: Row[] = countries.map((c) => ({
    name: c.id,
    realmId: "default",
    ownerUserId: "u1",
    governmentType: null,
    region: null,
    totalGovernmentSpending: null,
    currentTotalGdp: c.currentPopulation * c.currentGdpPerCapita,
    ...c,
  }));
  const db = {
    country: table("country", countryRows),
    defensePolicy: table("policy", []),
    militaryBranch: table("branch", []),
    procurementOrder: table("order", []),
    militaryAsset: table("asset", []),
    militaryUnit: table("unit", []),
    deployment: table("deployment", []),
    militaryEquipmentCatalog: table("catalog", []),
    governmentBudget: table("gb", []),
    governmentStructure: table("gs", []),
    militaryOperation: table("operation", []),
    militaryConflict: table("conflict", []),
    foreignPolicyAction: table("fp", []),
    diplomaticRelation: table("relation", []),
    storytellerEffect: table("effect", []),
    realm: table("realm", []),
    // No map: spatial queries find nothing, so the combat theatre falls back to the declared terrain.
    $queryRawUnsafe: async () => [],
    $transaction: async (arg: unknown): Promise<unknown> =>
      typeof arg === "function" ? (arg as (tx: unknown) => Promise<unknown>)(db) : Promise.all(arg as Promise<unknown>[]),
  };
  return db;
}

export type FakeDefenseDb = ReturnType<typeof fakeDefenseDb>;
