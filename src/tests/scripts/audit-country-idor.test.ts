/** @jest-environment node */
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "@jest/globals";
import { Project } from "ts-morph";
import {
  AUDITED_ROOTS,
  EXEMPT_ROOTS,
  analyzeSource,
} from "../../../scripts/audit/audit-country-idor";

const FILE = "src/server/api/routers/fixture.ts";

describe("audit-country-idor", () => {
  it("flags an unguarded rateLimitedMutationProcedure with countryId as MISSING", () => {
    const source = `
export const r = createTRPCRouter({
  writeWithoutCheck: rateLimitedMutationProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.policy.create({ data: input })),
});
`;
    const findings = analyzeSource(new Project({ useInMemoryFileSystem: true }), FILE, source);
    expect(findings).toEqual([
      expect.objectContaining({
        procedure: "writeWithoutCheck",
        root: "rateLimitedMutationProcedure",
        status: "MISSING",
      }),
    ]);
  });

  it("fails the audit when a mutation uses an unknown *Procedure root", () => {
    const source = `
export const r = createTRPCRouter({
  mystery: unlistedCustomProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.policy.create({ data: input })),
});
`;
    expect(() =>
      analyzeSource(new Project({ useInMemoryFileSystem: true }), FILE, source)
    ).toThrow(/Unknown procedure root "unlistedCustomProcedure"/);
  });

  it("covers every procedure builder exported from src/server/api/trpc/procedures.ts", () => {
    const proceduresText = fs.readFileSync(
      path.join(process.cwd(), "src/server/api/trpc/procedures.ts"),
      "utf8"
    );
    const exported = [...proceduresText.matchAll(/export const (\w+Procedure)\b/g)].map(
      (m) => m[1]!
    );
    expect(exported.length).toBeGreaterThan(0);
    for (const name of exported) {
      expect(AUDITED_ROOTS.has(name) || EXEMPT_ROOTS.has(name)).toBe(true);
    }
  });
});
