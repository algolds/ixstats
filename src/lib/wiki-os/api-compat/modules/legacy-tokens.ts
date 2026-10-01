/**
 * legacy-tokens.ts — `action=tokens` (plan 410), MediaWiki's old way to ask for a token. It answers
 * the old shape (`{"tokens": {"edittoken": ...}}`, no `query` around it): every write token is the
 * session's CSRF token, `watch` and `patrol` have their own.
 */

import { expectedToken, type TokenType } from "../auth";
import type { JsonObject } from "../format";
import type { ApiContext } from "../types";

/** The token type each legacy name stands for. */
const LEGACY_TYPES = {
  block: "csrf",
  delete: "csrf",
  edit: "csrf",
  email: "csrf",
  import: "csrf",
  move: "csrf",
  options: "csrf",
  patrol: "patrol",
  protect: "csrf",
  unblock: "csrf",
  watch: "watch",
} as const satisfies Record<string, TokenType>;

const LEGACY_NAMES = Object.keys(LEGACY_TYPES) as Array<keyof typeof LEGACY_TYPES>;

export function runLegacyTokens(rc: ApiContext): JsonObject {
  const p = rc.params.scope("", "tokens");
  const names = p.listOf("type", LEGACY_NAMES, ["edit"]);
  p.addWarning("action=tokens has been deprecated. Use action=query&meta=tokens instead.");
  const tokens: JsonObject = {};
  for (const name of names) tokens[`${name}token`] = expectedToken(rc.session, LEGACY_TYPES[name]);
  return { tokens };
}
