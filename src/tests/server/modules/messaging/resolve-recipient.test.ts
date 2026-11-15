import { resolveRecipient } from "~/server/modules/messaging/recipients";

function fakeDb(rows: {
  countries?: Record<string, { owner: { clerkUserId: string } | null }>;
  handles?: Record<string, string>;
}) {
  return {
    country: {
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => rows.countries?.[where.id] ?? null
      ),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { handle: string } }) => {
        const clerkUserId = rows.handles?.[where.handle];
        return clerkUserId ? { clerkUserId } : null;
      }),
    },
  } as unknown as Parameters<typeof resolveRecipient>[0];
}

describe("resolveRecipient", () => {
  it("resolves a country to its owner's Clerk id", async () => {
    const db = fakeDb({ countries: { c1: { owner: { clerkUserId: "user_owner" } } } });
    await expect(resolveRecipient(db, { countryId: "c1" })).resolves.toEqual({
      clerkUserId: "user_owner",
    });
  });

  it("is null for an unowned or unknown country", async () => {
    const db = fakeDb({ countries: { c2: { owner: null } } });
    await expect(resolveRecipient(db, { countryId: "c2" })).resolves.toBeNull();
    await expect(resolveRecipient(db, { countryId: "nope" })).resolves.toBeNull();
  });

  it("matches a handle case-insensitively and trimmed", async () => {
    const db = fakeDb({ handles: { herald: "user_herald" } });
    await expect(resolveRecipient(db, { handle: "  Herald " })).resolves.toEqual({
      clerkUserId: "user_herald",
    });
    await expect(resolveRecipient(db, { handle: "ghost" })).resolves.toBeNull();
  });
});
