/** Players named for staff, shared by the card admin's queues. */
import { loadPlayerNames, type PlayerName } from "~/server/modules/identity/identity.player-names";

/**
 * A player named for staff: the name other players read, else their passport handle (staff need to know who it is
 * even when other players read "a player"). No Vault cards switch applies to staff.
 */
export const staffName = (name: PlayerName) => name.displayName ?? name.handle;

/** Players named for staff, in one read (the inscription queue's `StaffNames`). */
export async function staffNames(userIds: readonly string[]): Promise<Map<string, string>> {
  const names = await loadPlayerNames(userIds);
  return new Map([...names].map(([id, name]) => [id, staffName(name)]));
}
