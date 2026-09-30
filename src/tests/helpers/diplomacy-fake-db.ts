/**
 * In-memory fake of the Prisma delegates the diplomatic-policies router touches
 * (foreign-policy actions, alliances and alliance members). Supports the subset of the
 * Prisma `where` language those procedures use: equality, null, `in`, `lt`/`lte`/`gt`/`gte`,
 * `not`, `OR`/`AND`, and the `alliance.members.some` relation filter.
 */
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Row = Record<string, any>;

export interface DiplomacyFakeState {
  foreignPolicyActions: Row[];
  alliances: Row[];
  allianceMembers: Row[];
  countries: Row[];
}

function matchValue(value: any, cond: any): boolean {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (cond && typeof cond === "object") {
    return Object.entries(cond).every(([op, arg]: [string, any]) => {
      const v = value instanceof Date ? value.getTime() : value;
      const a = arg instanceof Date ? arg.getTime() : arg;
      switch (op) {
        case "in":
          return (arg as any[]).includes(value);
        case "lt":
          return v != null && v < a;
        case "lte":
          return v != null && v <= a;
        case "gt":
          return v != null && v > a;
        case "gte":
          return v != null && v >= a;
        case "not":
          return !matchValue(value, arg);
        default:
          throw new Error(`fake db: unsupported operator ${op}`);
      }
    });
  }
  return value === cond;
}

export function createDiplomacyFakeDb(seed: Partial<DiplomacyFakeState> = {}) {
  const state: DiplomacyFakeState = {
    foreignPolicyActions: seed.foreignPolicyActions ?? [],
    alliances: seed.alliances ?? [],
    allianceMembers: seed.allianceMembers ?? [],
    countries: seed.countries ?? [],
  };
  let seq = 0;

  const countryById = (id: string) => state.countries.find((c) => c.id === id);

  const matches = (row: Row, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, cond]: [string, any]) => {
      if (k === "OR") return (cond as any[]).some((w) => matches(row, w));
      if (k === "AND") return (cond as any[]).every((w) => matches(row, w));
      if (k === "alliance" && cond?.members?.some) {
        const members = state.allianceMembers.filter((m) => m.allianceId === row.allianceId);
        return members.some((m) => matches(m, cond.members.some));
      }
      return matchValue(row[k], cond);
    });

  const countryRef = (id: string) => {
    const c = countryById(id);
    return { id, name: c?.name ?? id, flag: c?.flag ?? null };
  };
  const withFpRefs = (r: Row) => ({
    ...r,
    initiator: countryRef(r.initiatorId),
    target: countryRef(r.targetId),
  });
  const withMemberRefs = (m: Row) => ({
    ...m,
    alliance: state.alliances.find((a) => a.id === m.allianceId) ?? { id: m.allianceId },
    country: countryRef(m.countryId),
  });

  const applyUpdate = (row: Row, data: Row) => {
    Object.assign(row, data, { updatedAt: new Date() });
  };

  const db: any = createMockPrisma({
    foreignPolicyAction: {
      findUnique: jest.fn(async ({ where }: any) => {
        const r = state.foreignPolicyActions.find((x) => x.id === where.id);
        return r ? withFpRefs(r) : null;
      }),
      findFirst: jest.fn(
        async ({ where }: any) => state.foreignPolicyActions.find((x) => matches(x, where)) ?? null
      ),
      findMany: jest.fn(async ({ where }: any) =>
        state.foreignPolicyActions.filter((x) => matches(x, where)).map(withFpRefs)
      ),
      create: jest.fn(async ({ data }: any) => {
        const now = new Date();
        const r = { id: `fp${++seq}`, createdAt: now, updatedAt: now, ...data };
        state.foreignPolicyActions.push(r);
        return withFpRefs(r);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = state.foreignPolicyActions.find((x) => x.id === where.id)!;
        applyUpdate(r, data);
        return withFpRefs(r);
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = state.foreignPolicyActions.filter((x) => matches(x, where));
        hit.forEach((r) => applyUpdate(r, data));
        return { count: hit.length };
      }),
    },
    allianceMember: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return state.allianceMembers.find((m) => m.id === where.id) ?? null;
        const k = where.allianceId_countryId;
        return (
          state.allianceMembers.find(
            (m) => m.allianceId === k.allianceId && m.countryId === k.countryId
          ) ?? null
        );
      }),
      findMany: jest.fn(async ({ where }: any) =>
        state.allianceMembers.filter((m) => matches(m, where)).map(withMemberRefs)
      ),
      create: jest.fn(async ({ data }: any) => {
        const now = new Date();
        const m = { id: `m${++seq}`, createdAt: now, updatedAt: now, ...data };
        state.allianceMembers.push(m);
        return m;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const m = state.allianceMembers.find((x) => x.id === where.id)!;
        applyUpdate(m, data);
        return m;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = state.allianceMembers.filter((m) => matches(m, where));
        hit.forEach((m) => applyUpdate(m, data));
        return { count: hit.length };
      }),
      count: jest.fn(
        async ({ where }: any) => state.allianceMembers.filter((m) => matches(m, where)).length
      ),
    },
    alliance: {
      findUnique: jest.fn(
        async ({ where }: any) => state.alliances.find((a) => a.id === where.id) ?? null
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const a = state.alliances.find((x) => x.id === where.id);
        if (a) Object.assign(a, data);
        return a ?? {};
      }),
    },
    country: {
      findUnique: jest.fn(async ({ where }: any) => {
        const c = countryById(where.id);
        return c
          ? { currentGdpPerCapita: 30000, currentPopulation: 5_000_000, owner: null, ...c }
          : null;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        state.countries.filter((c) => matches(c, where)).map((c) => ({ owner: null, ...c }))
      ),
    },
    diplomaticRelation: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    bilateralTrade: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    storytellerEffect: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ countryId: null, role: { name: "member" } }),
    },
  });

  return { db, state };
}
