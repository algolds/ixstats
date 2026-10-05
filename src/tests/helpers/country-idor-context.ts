import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

/** The caller always owns CALLER_COUNTRY; FOREIGN_COUNTRY belongs to someone else. */
export const CALLER_COUNTRY = "country_caller";
export const FOREIGN_COUNTRY = "country_foreign";
export const CALLER_CLERK_ID = "user_caller";

/**
 * Router context for Plan 332 IDOR tests. `db` holds the delegates the procedure
 * under test needs; `user` and `country` lookups used by assertCountryWriteAccess
 * are added here. Both countries exist.
 */
export function createIdorContext(
  db: Record<string, object>,
  role: "member" | "admin" = "member"
): MockCallerContext {
  const user = {
    id: "db_user_caller",
    clerkUserId: CALLER_CLERK_ID,
    countryId: CALLER_COUNTRY,
    role: { name: role },
  };
  return createMockCallerContext({
    auth: { userId: CALLER_CLERK_ID },
    user,
    db: {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findMany: jest.fn().mockResolvedValue([]),
      },
      country: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          name: "Testland",
        })),
      },
      ...db,
    },
  });
}
