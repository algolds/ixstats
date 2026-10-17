/**
 * Discord Site URL
 *
 * The public origin and base path behind every IxStates link sent to Discord:
 * embed links, downloaded Discord images and the links inside converted markdown.
 */

const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";
export const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://maps.ixwiki.com"
).replace(/\/$/, "");
export const CLEAN_BASE_PATH = BASE_PATH
  ? (BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`).replace(/\/$/, "")
  : "";
