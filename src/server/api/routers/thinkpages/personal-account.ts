/**
 * Personal personas: one ThinkPages account per user that is "you", not a character or a nation.
 *
 * A personal persona has `accountType: "personal"` and no `countryId`. Uniqueness per user is
 * enforced by the `ThinkpagesPersonalAccount` row (primary key = Clerk user id), so two concurrent
 * "post as yourself" calls cannot create two personas.
 */
import { Prisma, type PrismaClient, type ThinkpagesAccount } from "@prisma/client";

export const PERSONAL_ACCOUNT_TYPE = "personal";

/** Usernames follow the same rules as `createAccount`: a letter, then letters/digits/_ (3-20). */
const USERNAME_MAX = 20;
const FALLBACK_USERNAME_BASE = "member";
const MAX_CREATE_ATTEMPTS = 6;

type PersonalDb = Pick<
  PrismaClient,
  "thinkpagesAccount" | "thinkpagesPersonalAccount" | "user" | "$transaction"
>;

export interface PersonalAccountPreferences {
  username?: string | null;
  displayName?: string | null;
}

export function isPersonalAccount(account: { accountType?: string | null } | null | undefined) {
  return account?.accountType === PERSONAL_ACCOUNT_TYPE;
}

/** Reduce any name to a valid username stem, or null when nothing usable is left. */
export function toUsernameBase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^a-zA-Z0-9_]/g, "");
  s = s.replace(/^[^a-zA-Z]+/, "");
  if (s.length < 3) return null;
  return s.slice(0, USERNAME_MAX);
}

/** Candidate username for attempt n: the base, then base_me, then base_<4 random digits>. */
export function usernameCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const tail = attempt === 1 ? "_me" : `_${Math.floor(1000 + Math.random() * 9000)}`;
  return `${base.slice(0, USERNAME_MAX - tail.length)}${tail}`;
}

/** The caller's personal persona, or null if they have not got one yet. */
export async function findPersonalAccount(
  db: Pick<PrismaClient, "thinkpagesAccount" | "thinkpagesPersonalAccount">,
  clerkUserId: string
): Promise<ThinkpagesAccount | null> {
  const link = await db.thinkpagesPersonalAccount.findUnique({ where: { clerkUserId } });
  if (!link) return null;
  const account = await db.thinkpagesAccount.findUnique({ where: { id: link.accountId } });
  // Guard against a stale link (account removed, or reassigned by an admin).
  if (!account || account.clerkUserId !== clerkUserId) return null;
  return account;
}

function isUniqueViolation(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Return the caller's personal persona, creating it on first use. Never attaches a country.
 * A deactivated personal persona is reactivated, because asking to act "as yourself" is explicit.
 */
export async function ensurePersonalAccount(
  db: PersonalDb,
  clerkUserId: string,
  prefs: PersonalAccountPreferences = {}
): Promise<ThinkpagesAccount> {
  const existing = await findPersonalAccount(db, clerkUserId);
  if (existing) {
    if (existing.isActive) return existing;
    return db.thinkpagesAccount.update({ where: { id: existing.id }, data: { isActive: true } });
  }

  // A link whose account is gone would block creation; clear it.
  await db.thinkpagesPersonalAccount.deleteMany({ where: { clerkUserId } });

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { forumUsername: true, wikiUsername: true },
  });
  const base =
    toUsernameBase(prefs.username) ??
    toUsernameBase(user?.forumUsername) ??
    toUsernameBase(user?.wikiUsername) ??
    FALLBACK_USERNAME_BASE;
  const displayName =
    prefs.displayName?.trim().slice(0, 50) ||
    user?.forumUsername ||
    user?.wikiUsername ||
    prefs.username?.trim() ||
    base;

  // The fallback stem is generic, so skip straight to a suffixed name for it.
  const firstAttempt = base === FALLBACK_USERNAME_BASE ? 2 : 0;
  for (let attempt = firstAttempt; attempt < firstAttempt + MAX_CREATE_ATTEMPTS; attempt++) {
    const username = usernameCandidate(base, attempt);
    const taken = await db.thinkpagesAccount.findUnique({ where: { username } });
    if (taken) continue;
    try {
      return await db.$transaction(async (tx) => {
        const account = await tx.thinkpagesAccount.create({
          data: {
            clerkUserId,
            countryId: null,
            accountType: PERSONAL_ACCOUNT_TYPE,
            username,
            displayName,
            firstName: displayName,
            lastName: "",
            bio: "",
            verified: false,
          },
        });
        await tx.thinkpagesPersonalAccount.create({
          data: { clerkUserId, accountId: account.id },
        });
        return account;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Another request created the caller's personal persona first: use that one.
      const raced = await findPersonalAccount(db, clerkUserId);
      if (raced) return raced;
      // Otherwise the username was taken between the check and the insert: try the next one.
    }
  }

  throw new Error("Could not find a free username for your personal account");
}
