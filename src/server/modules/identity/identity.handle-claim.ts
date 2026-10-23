/**
 * Claiming or changing a user's IxStates Passport handle (`ixnayid.setHandle`). A first claim (no
 * stored handle) is free; changing a stored handle is allowed once (`User.handleChangedAt`), and
 * admins may always change theirs. A handle that MediaWiki normalises to an old wiki name another account holds is
 * refused, under that name's lock (claim approval checks the other way round, identity.name-claims.ts).
 * `suggestHandleFor` prefills the WikiOS first-save handle picker.
 */
import { Prisma } from "@prisma/client";
import { lockWikiNameTx } from "~/lib/identity/claim-tags";
import { claimName, IXWIKI, namesOfUser, ownerOfName } from "~/lib/identity/wiki-names";
import { db } from "~/server/db";
import { chooseBackfillHandle, pickAvailableHandle, validateHandle } from "./identity.handle";

type HandleClaimErrorCode = "FORMAT" | "RESERVED" | "TAKEN" | "ALREADY_CHANGED" | "NO_USER";

export class HandleClaimError extends Error {
  constructor(
    public readonly code: HandleClaimErrorCode,
    message: string
  ) {
    super(message);
    this.name = "HandleClaimError";
  }
}

const FORMAT_MESSAGE = "Use 3 to 24 lowercase letters, numbers or underscores.";

function takenError(handle: string): HandleClaimError {
  return new HandleClaimError("TAKEN", `@${handle} is already taken.`);
}

function isUniqueViolation(error: Error): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Validate, check availability and the single-change rule, then save the handle. */
export async function setUserHandle(input: {
  userId: string;
  handle: string;
  isAdmin: boolean;
}): Promise<{ handle: string }> {
  const valid = validateHandle(input.handle);
  if (!valid.ok) {
    throw valid.reason === "reserved"
      ? new HandleClaimError("RESERVED", "That handle is reserved.")
      : new HandleClaimError("FORMAT", FORMAT_MESSAGE);
  }
  const { handle } = valid;

  const current = await db.user.findUnique({
    where: { id: input.userId },
    select: { handle: true, handleChangedAt: true },
  });
  if (!current) throw new HandleClaimError("NO_USER", "No account found.");
  if (current.handle === handle) return { handle };
  const isChange = current.handle !== null;
  if (isChange && current.handleChangedAt && !input.isAdmin) {
    throw new HandleClaimError("ALREADY_CHANGED", "You have already changed your handle once.");
  }

  try {
    return await db.$transaction(async (tx) => {
      await lockWikiNameTx(tx, IXWIKI, handle);
      const claimant = await ownerOfName(tx, IXWIKI, handle);
      if (claimant !== null && claimant !== input.userId) {
        throw new HandleClaimError(
          "TAKEN",
          "That handle belongs to an old wiki name another player holds."
        );
      }
      const holder = await tx.user.findFirst({
        where: { handle, NOT: { id: input.userId } },
        select: { id: true },
      });
      if (holder) throw takenError(handle);
      const saved = await tx.user.update({
        where: { id: input.userId },
        // Only a change of a stored handle uses up the one self-service change.
        data: isChange ? { handle, handleChangedAt: new Date() } : { handle },
        select: { handle: true },
      });
      return { handle: saved.handle ?? handle };
    });
  } catch (error) {
    if (error instanceof Error && isUniqueViolation(error)) throw takenError(handle);
    throw error;
  }
}

/**
 * Leaves room for `pickAvailableHandle`'s numeric suffix: a 24-character base becomes `<first 22>_2`, which does not
 * start with the base, so stored handles are matched on a shorter prefix.
 */
const TAKEN_PREFIX_LENGTH = 20;

/**
 * The handle the first-save picker offers a handle-less player: from their first shown wiki name, else their forum
 * name, else their nation's name (`chooseBackfillHandle`), numbered past the stored handles and the old wiki names
 * other players hold (which `setUserHandle` refuses). Never a hidden claim's name, nor a name spelling one; null when
 * no name gives a handle.
 */
export async function suggestHandleFor(userId: string): Promise<string | null> {
  const [user, claims] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { forumUsername: true, country: { select: { name: true } } },
    }),
    namesOfUser(db, userId),
  ]);
  const choice = chooseBackfillHandle(
    {
      wiki: claims.find((claim) => claim.visible)?.name ?? null,
      forum: user?.forumUsername ?? null,
      persona: null,
      nation: user?.country?.name ?? null,
    },
    claims.filter((claim) => !claim.visible).map((claim) => claim.name)
  );
  if (!choice) return null;
  const prefix = choice.handle.slice(0, TAKEN_PREFIX_LENGTH);
  const [stored, othersNames] = await Promise.all([
    db.user.findMany({ where: { handle: { startsWith: prefix } }, select: { handle: true } }),
    db.wikiNameClaim.findMany({
      where: {
        source: IXWIKI,
        status: "APPROVED",
        NOT: { userId },
        name: { startsWith: claimName(prefix) },
      },
      select: { name: true },
    }),
  ]);
  const taken = new Set(stored.flatMap((row) => (row.handle ? [row.handle] : [])));
  const claimed = new Set(othersNames.map((claim) => claim.name));
  return pickAvailableHandle(choice.handle, {
    has: (handle) => taken.has(handle) || claimed.has(claimName(handle)),
  });
}
