/**
 * Where the World tab of the world editor opens from. Client-safe.
 *
 * - A realm's Manage page links to `/maps?realm=<slug>&editor=world`, which opens the realm's map in the world
 *   editor on its World tab (the pattern of `editor=labels`, `realm-labels.ts`).
 * - The admin studio links to `/admin/maps/editor?sandbox=1`: the World tab alone, nothing applied.
 */
import { wantsRealmLabelsEditor } from "./realm-labels";

const WORLD_EDITOR = "world";

type Params = Pick<URLSearchParams, "get"> | null;

/** A link to generate or regenerate a realm's world on its map. */
export const realmWorldEditorHref = (realmSlug: string) =>
  `/maps?realm=${encodeURIComponent(realmSlug)}&editor=${WORLD_EDITOR}`;

/** Whether the map's address asks for the World tab. */
export const wantsRealmWorldEditor = (params: Params) => params?.get("editor") === WORLD_EDITOR;

/** Whether the map's address asks for the world editor to open at all (for the labels dialog or the World tab). */
export const wantsRealmMapEditor = (params: Params) =>
  wantsRealmLabelsEditor(params) || wantsRealmWorldEditor(params);

/** The studio's sandbox: generate and compare against the Ixnay and Eurth targets, without applying anything. */
export const WORLD_SANDBOX_HREF = "/admin/maps/editor?sandbox=1";

export const isWorldSandbox = (params: Params) => params?.get("sandbox") === "1";

/** A section of a realm's Manage page. */
export const realmManageHref = (realmSlug: string, section: "map-import" | "claims") =>
  `/r/${encodeURIComponent(realmSlug)}/manage#${section}`;
