import type { RouterOutputs } from "~/trpc/react";

type PassportOutputs = RouterOutputs["ixnayid"];

export type PassportPayload = NonNullable<PassportOutputs["getPassport"]>;

export type RealmItem = PassportOutputs["getRealms"][number];

export type WorkPayload = PassportOutputs["getWork"];

export type HistoryItem = PassportOutputs["getHistory"]["items"][number];

export type PassportWiki = PassportPayload["wiki"];

export type PassportForum = PassportPayload["forum"];

/** The Vault section; the payload carries null instead when the owner hides it. */
export type PassportVault = NonNullable<PassportPayload["vault"]>;

export type PassportAchievements = NonNullable<PassportPayload["showcase"]["achievements"]>;

export type PassportRibbon = PassportAchievements["ribbons"][number];
export type PassportTabType = "realms" | "work" | "collection" | "history";

/**
 * Owner's passport visibility, saved in `PassportPreference`. A hidden section is stripped from the
 * public passport server-side, so it is absent for every viewer (owner included).
 */
export type PassportVisibility = PassportPayload["privacy"];
