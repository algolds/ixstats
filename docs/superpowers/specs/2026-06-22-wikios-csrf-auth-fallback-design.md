# Design Document: WikiOS CSRF Auth Fallback via IxnayID

## Purpose
Currently, WikiOS edit operations fail if the user's MediaWiki session cookies are missing, invalid, or expired, returning an `Invalid CSRF token` error. 

To make editing seamless, this spec introduces a robust auth fallback: if a user has linked their MediaWiki account via IxnayID (meaning their `wikiUsername` is set in their user profile), we will try to execute the edit using their own session cookies first. If their cookies are missing, invalid, or expired (causing MediaWiki to return `+\\` or a token retrieval failure), we will fallback to the authenticated bot session to perform the edit on MediaWiki.

The edit history on MediaWiki will still attribute the edit to the correct user because we pass their linked `wikiUsername` in the edit summary.

---

## Technical Details

### 1. Modifying `getUserSessionAndToken` in `src/lib/wiki-os/csrf-cache.ts`
* **File:** [csrf-cache.ts](file:///ixwiki/public/projects/ixstats/src/lib/wiki-os/csrf-cache.ts)
* **Changes:**
  * Keep the existing precondition check that ensures `wikiUsername` is linked via `getWikiAuth(ctx)`. If not linked, throw `PRECONDITION_FAILED`.
  * If a `cookieHeader` exists in the request headers:
    * Try fetching the user's CSRF token from MediaWiki with their cookies.
    * If the returned token is valid (not undefined and not equal to `"+\\"`), return the user's own cookies and token.
    * If the token is invalid (`"+\\"`), or the request fails/throws, log a warning indicating that the user's session is invalid/expired and fall back to the bot session instead of throwing an `UNAUTHORIZED` error.
  * If no `cookieHeader` is present in the request:
    * Log a warning and immediately fall back to the bot session using `getBotSessionAndToken()`.
  * Make sure any thrown errors in the bot fallback flow propagate cleanly.

### 2. Verification of Edit Attribution
* **File:** [editing.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/editing.ts)
* **Review:**
  * When `saveToMediaWiki` executes the edit, it uses the CSRF token and cookies returned by `getUserSessionAndToken(ctx)`.
  * It passes the summary parameter:
    ```typescript
    summary: `${summary} (via WikiOS by ${getWikiActorLabel(ctx)})`,
    ```
  * `getWikiActorLabel(ctx)` correctly returns `wikiUsername ?? userId ?? "anonymous"`. Because `wikiUsername` is verified to be non-null by the first check in `getUserSessionAndToken`, the edit summary on MediaWiki will always contain `(via WikiOS by <wikiUsername>)`.
