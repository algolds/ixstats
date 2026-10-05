import { renderHook } from "@testing-library/react";

type Role = { name: string; level: number } | null;

let authUser: { id: string; publicMetadata?: Record<string, unknown> } | null;
let dbRole: Role;
let loading: boolean;

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: authUser, isSignedIn: Boolean(authUser), isLoaded: true }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      getCurrentUserWithRole: {
        useQuery: () => ({
          data: dbRole ? { user: { role: { ...dbRole, permissions: [] } } } : { user: null },
          isLoading: loading,
          error: null,
        }),
      },
    },
  },
}));
jest.mock("~/lib/auth", () => ({ isSystemOwner: (id: string) => id === "owner-id" }));

import { useIsBetaTester } from "~/hooks/usePermissions";

beforeEach(() => {
  authUser = { id: "u1" };
  dbRole = null;
  loading = false;
});

describe("useIsBetaTester", () => {
  it("is false signed out", () => {
    authUser = null;
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(false);
  });

  it("is true for the system owner without a database role", () => {
    authUser = { id: "owner-id" };
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(true);
  });

  it("does not trust a beta role that exists only in Clerk metadata", () => {
    authUser = { id: "u1", publicMetadata: { role: "beta_tester" } };
    dbRole = { name: "user", level: 100 };
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(false);
  });

  it("does not trust Clerk metadata while the database role is still loading", () => {
    authUser = { id: "u1", publicMetadata: { role: "admin" } };
    loading = true;
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(false);
  });

  it("is true for a database beta role", () => {
    dbRole = { name: "beta_tester", level: 90 };
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(true);
  });

  it("is true for staff level and above, false for a plain user", () => {
    dbRole = { name: "moderator-x", level: 20 };
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(true);
    dbRole = { name: "user", level: 100 };
    expect(renderHook(() => useIsBetaTester()).result.current).toBe(false);
  });
});
