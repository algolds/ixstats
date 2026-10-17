// src/lib/cards/hub/players.ts

/** A player as the card hub may name them: their passport handle, and whether their passport shows Vault cards. */
export interface HubPlayer {
  handle: string;
  showsVault: boolean;
}

/**
 * The players a surface names, read in one batch. The router supplies it, as lib code never imports server modules; a
 * user who no longer exists is missing from the map.
 */
export interface PlayerRules {
  playersOf: (userIds: readonly string[]) => Promise<ReadonlyMap<string, HubPlayer>>;
}
