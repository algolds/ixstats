/** @jest-environment node */
import { requireAdminSession } from "~/server/shared/route-auth";

const mockAuth = jest.fn();
const mockIsAdmin = jest.fn();

jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
jest.mock("~/server/shared/admin-access", () => ({
  isAdminClerkUser: (id: string) => mockIsAdmin(id),
}));

describe("requireAdminSession", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockIsAdmin.mockReset();
  });

  it("returns 401 without a session", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const result = await requireAdminSession();
    expect("status" in result && result.status).toBe(401);
  });

  it("returns 403 when Clerk metadata says admin but the database rule denies", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", sessionClaims: { metadata: { role: "admin" } } });
    mockIsAdmin.mockResolvedValue(false);
    const result = await requireAdminSession("nope");
    expect("status" in result && result.status).toBe(403);
    expect(mockIsAdmin).toHaveBeenCalledWith("u1");
  });

  it("returns the userId when the database rule allows, with no Clerk metadata", async () => {
    mockAuth.mockResolvedValue({ userId: "u2", sessionClaims: {} });
    mockIsAdmin.mockResolvedValue(true);
    expect(await requireAdminSession()).toEqual({ userId: "u2" });
  });
});
