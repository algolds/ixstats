/**
 * How much a player's showcases hold, shared by the server and the showcase dialogs. A plain module, so the client
 * never imports the showcase queries. The name and description keep the old collection limits, so a migrated
 * collection stays editable as it stands.
 */
export const SHOWCASE_LIMITS = { perPlayer: 20, items: 60, name: 100, description: 500 } as const;
