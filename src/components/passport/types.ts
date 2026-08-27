import type { RouterOutputs } from "~/trpc/react";

export type UnifiedProfilePayload = NonNullable<RouterOutputs["ixnayid"]["getUnifiedProfile"]>;

export type RealmItem = UnifiedProfilePayload["realms"][number];

export type WorkPayload = UnifiedProfilePayload["work"];
export type LorePayload = UnifiedProfilePayload["work"];

export type HistoryItem = UnifiedProfilePayload["history"][number];

export type PassportAccount = UnifiedProfilePayload["account"];

export type PassportWiki = UnifiedProfilePayload["wiki"];

export type PassportForum = UnifiedProfilePayload["forum"];

export type PassportVault = UnifiedProfilePayload["vault"];

export type PassportThinkPages = UnifiedProfilePayload["thinkpages"];

export type PassportTabType = "realms" | "lore" | "work" | "wiki" | "history" | "vault";
