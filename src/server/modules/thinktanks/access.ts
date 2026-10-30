/** Which ThinkTank groups non-members may read. The tRPC access rules re-export this. */
import { REALM_BOARD_PUBLIC_READ, REALM_BOARD_TYPE } from "~/server/shared/realm-board";

/** Whether a group of this type is readable by non-members. */
export function canReadGroupType(type: string): boolean {
  return type === "public" || (type === REALM_BOARD_TYPE && REALM_BOARD_PUBLIC_READ);
}
