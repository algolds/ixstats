/** The nav and Halo show the way into /admin by the same rule the server applies (isAdminRole on the DB role). */
import { renderHook } from "@testing-library/react";

type Role = { name: string; level: number } | null;

let authUser: { id: string; publicMetadata?: { role?: string } } | null;
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

import { useCanOpenAdmin } from "~/hooks/usePermissions";

const canOpen = () => renderHook(() => useCanOpenAdmin()).result.current;

beforeEach(() => {
  authUser = { id: "u1" };
  dbRole = null;
  loading = false;
});

describe("useCanOpenAdmin", () => {
  it("is false signed out", () => {
    authUser = null;
    expect(canOpen()).toBe(false);
  });

  it("is true for the system owner without a database role", () => {
    authUser = { id: "owner-id" };
    expect(canOpen()).toBe(true);
  });

  it("is true for a staff-level DB role that is not named admin", () => {
    dbRole = { name: "member", level: 20 };
    expect(canOpen()).toBe(true);
  });

  it("is true for a staff role name", () => {
    dbRole = { name: "staff", level: 50 };
    expect(canOpen()).toBe(true);
  });

  it("is false for a plain user, even with an admin role in Clerk metadata", () => {
    authUser = { id: "u1", publicMetadata: { role: "admin" } };
    dbRole = { name: "user", level: 100 };
    expect(canOpen()).toBe(false);
  });

  it("is false while the DB role is loading", () => {
    loading = true;
    dbRole = { name: "admin", level: 10 };
    expect(canOpen()).toBe(false);
  });
});
