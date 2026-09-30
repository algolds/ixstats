import { Project } from "ts-morph";
import {
  analyzeSource,
  applyAllowlist,
  isFailing,
} from "../../../scripts/audit/audit-country-idor";

const FILE = "src/server/api/routers/fixture.ts";

const SOURCE = `
export const fixtureRouter = createTRPCRouter({
  guarded: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return ctx.db.policy.create({ data: input });
    }),
  unguarded: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.policy.create({ data: input })),
  inline: countryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.country.id !== input.countryId) throw new TRPCError({ code: "FORBIDDEN" });
    }),
  rowById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.cabinetMeeting.delete({ where: { id: input.id } })),
  unrelatedRow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.forumPost.delete({ where: { id: input.id } })),
  adminOnly: adminProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.country.delete({ where: { id: input.countryId } })),
  readOnly: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.policy.findMany({ where: input })),
});
`;

function analyze() {
  return analyzeSource(new Project({ useInMemoryFileSystem: true }), FILE, SOURCE);
}

describe("Plan 332: country IDOR audit detector", () => {
  it("classifies country-scoped mutations and skips admin, queries and unrelated rows", () => {
    const byName = Object.fromEntries(analyze().map((f) => [f.procedure, f.status]));
    expect(byName).toEqual({
      guarded: "OK",
      unguarded: "MISSING",
      inline: "MANUAL",
      rowById: "MISSING",
    });
  });

  it("allowlists only the named procedures and fails while anything is unresolved", () => {
    const findings = applyAllowlist(analyze(), {
      [`${FILE}#inline`]: "compares ctx.country.id to input.countryId",
      [`${FILE}#unguarded`]: "reviewed",
      [`${FILE}#rowById`]: "reviewed",
    });
    expect(findings.find((f) => f.procedure === "inline")?.status).toBe("ALLOWED");
    expect(isFailing(findings)).toBe(false);
    expect(isFailing(analyze())).toBe(true);
  });
});
