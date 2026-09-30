// src/lib/wiki-os/page-admin-ui.ts
// Pure helpers for the WikiOS page-admin screens (move, delete, protect, block, user rights, log):
// which actions to offer, expiry choices, and how a log entry reads. Client-safe: no server imports.

import { z } from "zod/v4";
import type { Prisma } from "@prisma/client";
import type { Right } from "~/lib/wiki-os/rights";

export interface PageAdminAction {
  id: "move" | "delete" | "protect";
  label: string;
  description: string;
  /** App path (no base path) of the screen, with the page title as `?title=`. */
  href: string;
}

const PAGE_ACTIONS: ReadonlyArray<Omit<PageAdminAction, "href"> & { right: Right; path: string }> =
  [
    {
      id: "move",
      right: "move",
      label: "Move page",
      description: "Rename it, leaving a redirect",
      path: "/util/move",
    },
    {
      id: "protect",
      right: "protect",
      label: "Protect page",
      description: "Limit who can edit or move it",
      path: "/util/protect",
    },
    {
      id: "delete",
      right: "delete",
      label: "Delete page",
      description: "Hide it from readers",
      path: "/util/delete",
    },
  ];

/** The page-management actions the caller may use on `title`: one per right they hold. */
export function pageAdminActions(title: string, rights: readonly Right[]): PageAdminAction[] {
  return PAGE_ACTIONS.filter((action) => rights.includes(action.right)).map((action) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    href: `${action.path}?title=${encodeURIComponent(title)}`,
  }));
}

/** What a page protection can hold back, in the order the protect screen lists them. */
export const PROTECT_ACTIONS = ["edit", "move", "upload", "create"] as const;
export type ProtectAction = (typeof PROTECT_ACTIONS)[number];

/** The protect screen's form state: a level and an expiry per action, and whether Move was chosen on its own. */
export interface ProtectionDraft<Level, Expiry> {
  levels: Record<ProtectAction, Level>;
  expiries: Record<ProtectAction, Expiry>;
  moveChosen: boolean;
}

/**
 * `draft` after `action` is set to `value`. Choosing Edit also sets Move to the same value until Move has
 * been chosen on its own (MediaWiki's "chain": a page nobody else may edit is not one anybody else may move).
 */
function chooseValue<Level, Expiry, Key extends "levels" | "expiries">(
  draft: ProtectionDraft<Level, Expiry>,
  key: Key,
  action: ProtectAction,
  value: ProtectionDraft<Level, Expiry>[Key][ProtectAction]
): ProtectionDraft<Level, Expiry> {
  const chained = action === "edit" && !draft.moveChosen;
  return {
    ...draft,
    moveChosen: draft.moveChosen || action === "move",
    [key]: { ...draft[key], [action]: value, ...(chained ? { move: value } : {}) },
  };
}

export const chooseLevel = <Level, Expiry>(
  draft: ProtectionDraft<Level, Expiry>,
  action: ProtectAction,
  level: Level
) => chooseValue(draft, "levels", action, level);

export const chooseExpiry = <Level, Expiry>(
  draft: ProtectionDraft<Level, Expiry>,
  action: ProtectAction,
  expiry: Expiry
) => chooseValue(draft, "expiries", action, expiry);

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a block, protection or group membership lasts. */
export const EXPIRY_PRESETS = [
  { value: "infinite", label: "Indefinitely", ms: null },
  { value: "1d", label: "1 day", ms: DAY_MS },
  { value: "1w", label: "1 week", ms: 7 * DAY_MS },
  { value: "1m", label: "1 month", ms: 30 * DAY_MS },
  { value: "1y", label: "1 year", ms: 365 * DAY_MS },
] as const;

export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["value"];

/** The moment a preset ends, counted from `now`; null for "indefinitely". */
export function expiryFromPreset(preset: ExpiryPreset, now = new Date()): Date | null {
  const { ms } = EXPIRY_PRESETS.find((option) => option.value === preset) ?? EXPIRY_PRESETS[0];
  return ms === null ? null : new Date(now.getTime() + ms);
}

/** "indefinitely" or "until <date>". */
export function describeExpiry(expiresAt: Date | null): string {
  return expiresAt ? `until ${expiresAt.toLocaleString()}` : "indefinitely";
}

/** The log types `getLog` filters by, as a select offers them. */
export const LOG_TYPE_OPTIONS = [
  { value: "move", label: "Move log" },
  { value: "delete", label: "Deletion log" },
  { value: "protect", label: "Protection log" },
  { value: "block", label: "Block log" },
  { value: "rights", label: "User rights log" },
  { value: "upload", label: "Upload log" },
] as const;

const MovedParams = z.object({ oldTitle: z.string(), newTitle: z.string() });
const ProtectParams = z.object({
  restrictions: z.array(z.object({ action: z.string(), level: z.string().nullable() })),
});
const BlockParams = z.object({ expiry: z.string() });
const RightsParams = z.object({ added: z.array(z.string()), removed: z.array(z.string()) });

export interface LogLine {
  type: string;
  action: string;
  title: string;
  /** JSON as stored with the entry. */
  params: Prisma.JsonValue | null;
}

const userName = (title: string): string => title.replace(/^User:/, "");

function describeBlock({ action, title, params }: LogLine): string {
  const name = userName(title);
  if (action === "unblock") return `unblocked ${name}`;
  const expiry = BlockParams.safeParse(params);
  const when =
    expiry.success && expiry.data.expiry !== "infinity"
      ? ` until ${new Date(expiry.data.expiry).toLocaleString()}`
      : " indefinitely";
  return `${action === "reblock" ? "changed the block of" : "blocked"} ${name}${when}`;
}

function describeRights({ title, params }: LogLine): string {
  const changes = RightsParams.safeParse(params);
  if (!changes.success) return `changed the groups of ${userName(title)}`;
  const parts = [
    ...(changes.data.added.length ? [`added ${changes.data.added.join(", ")}`] : []),
    ...(changes.data.removed.length ? [`removed ${changes.data.removed.join(", ")}`] : []),
  ];
  return `changed the groups of ${userName(title)}: ${parts.join("; ")}`;
}

/** One line in the log's voice: `moved page "A" to "B"`. */
export function describeLogEntry(line: LogLine): string {
  const { type, action, title, params } = line;
  if (type === "move") {
    const moved = MovedParams.safeParse(params);
    return moved.success
      ? `moved page "${moved.data.oldTitle}" to "${moved.data.newTitle}"`
      : `moved page "${title}"`;
  }
  if (type === "delete") return `${action === "restore" ? "restored" : "deleted"} page "${title}"`;
  if (type === "protect") {
    if (action === "unprotect") return `removed the protection of "${title}"`;
    const protect = ProtectParams.safeParse(params);
    const levels = protect.success
      ? protect.data.restrictions
          .filter((r) => r.level !== null)
          .map((r) => `${r.action}: ${r.level}`)
          .join(", ")
      : "";
    return `protected "${title}"${levels ? ` (${levels})` : ""}`;
  }
  if (type === "block") return describeBlock(line);
  if (type === "rights") return describeRights(line);
  return `${action} "${title}"`;
}
