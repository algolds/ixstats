import type { RouterOutputs } from "~/trpc/react";

type PassportOutputs = RouterOutputs["ixnayid"];

export type PassportPayload = NonNullable<PassportOutputs["getPassport"]>;

export type RealmItem = PassportOutputs["getRealms"][number];

export type WorkPayload = PassportOutputs["getWork"];

export type HistoryItem = PassportOutputs["getHistory"]["items"][number];

export type PassportWiki = PassportPayload["wiki"];

export type PassportVault = PassportPayload["vault"];

export type PassportTabType = "overview" | "realms" | "work" | "vault" | "history";

/** Owner's display toggles on the passport's back face (session-only, not persisted). */
export interface PassportVisibility {
  accolades: boolean;
  impact: boolean;
  forumStats: boolean;
  vaultCards: boolean;
  historyStream: boolean;
}
