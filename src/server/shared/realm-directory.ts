/**
 * The realm listing rule, shared by the realm directory (routers/realms/places.ts) and the
 * IxStates Passport (identity module), which lists only nations in realms the directory lists.
 */
import type { Prisma } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

/**
 * Realms the directory lists: active public realms, plus IxWorld whatever its row says (AT-6). Unlisted realms are
 * reachable by link only and never listed; draft and generating realms are shown only to their staff, by link.
 */
export const DIRECTORY_REALM_WHERE = {
  OR: [{ id: DEFAULT_REALM_ID }, { visibility: "public", status: "active" }],
} satisfies Prisma.RealmWhereInput;
