/** @jest-environment node */
// Final wave (ruling E-t): the admin flag warmers ask for every realm's nations. `realm: "*"` is only
// honoured for site admins (ruling E-o), so a non-admin request still gets its own realm.
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({
    userId: "user_admin",
    sessionClaims: { metadata: { role: "admin" } },
  }),
}));
jest.mock("~/trpc/server", () => ({
  api: {
    countries: { getAll: jest.fn().mockResolvedValue({ countries: [{ name: "Gallambria" }] }) },
  },
}));
jest.mock("~/lib/flags/server", () => ({
  serverFlagResolver: { prefetch: jest.fn(), resolveBatch: jest.fn().mockResolvedValue(new Map()) },
}));

import { NextRequest } from "next/server";
import { api } from "~/trpc/server";
import { GET as getCache, POST as postCache } from "~/app/api/flag-cache/route";
import { POST as initFlags } from "~/app/api/admin/init-flags/route";
import { ALL_REALMS } from "~/lib/realms/realm-ids";

const getAll = api.countries.getAll as unknown as jest.Mock;

describe("admin flag warmers read every realm", () => {
  beforeEach(() => getAll.mockClear());

  it.each([
    [
      "POST /api/flag-cache?action=initialize",
      () =>
        postCache(
          new NextRequest("http://localhost:3000/api/flag-cache?action=initialize", {
            method: "POST",
          })
        ),
    ],
    [
      "POST /api/flag-cache?action=update with no names",
      () =>
        postCache(
          new NextRequest("http://localhost:3000/api/flag-cache?action=update", {
            method: "POST",
            body: JSON.stringify({ countries: [] }),
          })
        ),
    ],
    [
      "GET /api/flag-cache?action=flags with no names",
      () => getCache(new NextRequest("http://localhost:3000/api/flag-cache?action=flags")),
    ],
  ])("%s", async (_name, call) => {
    const res = await call();
    expect(res?.status).toBe(200);
    expect(getAll).toHaveBeenCalledWith({ limit: 1000, realm: ALL_REALMS });
  });

  it("POST /api/admin/init-flags", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));
    const res = await initFlags(
      new NextRequest("http://localhost:3000/api/admin/init-flags", { method: "POST" })
    );

    expect(res.status).toBe(200);
    expect(getAll).toHaveBeenCalledWith({ limit: 1000, realm: ALL_REALMS });
    fetchSpy.mockRestore();
  });
});
