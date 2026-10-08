/**
 * Claiming or changing a user's IxStates Passport handle (`ixnayid.setHandle`). A first claim (no
 * stored handle) is free; changing a stored handle is allowed once (`User.handleChangedAt`), and
 * admins may always change theirs.
 */
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { validateHandle } from "./identity.handle";

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

  const holder = await db.user.findFirst({
    where: { handle, NOT: { id: input.userId } },
    select: { id: true },
  });
  if (holder) throw takenError(handle);

  try {
    const saved = await db.user.update({
      where: { id: input.userId },
      // Only a change of a stored handle uses up the one self-service change.
      data: isChange ? { handle, handleChangedAt: new Date() } : { handle },
      select: { handle: true },
    });
    return { handle: saved.handle ?? handle };
  } catch (error) {
    if (error instanceof Error && isUniqueViolation(error)) throw takenError(handle);
    throw error;
  }
}
