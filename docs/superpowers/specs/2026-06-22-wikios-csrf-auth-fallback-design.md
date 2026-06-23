# Design Spec: Native WikiOS Edits via Direct Database Actor Rewriting

## Purpose
Currently, WikiOS edit operations fail if the user's MediaWiki session cookies are missing, invalid, or expired, returning an `Invalid CSRF token` error. 

To resolve this reliably and ensure that edits "feel native" (i.e. are recorded under the actual user's MediaWiki account in history, diffs, contributions, and feeds), we will:
1. Simplify the authentication logic by always performing MediaWiki API write actions (edits, uploads) using the authenticated bot session (avoiding browser session cookie-forwarding and session mismatches).
2. Immediately after a write action succeeds, perform direct MySQL database queries on the MediaWiki database to rewrite the revision's author (and associated tables like `recentchanges`, `logging`, and `image`) to match the user's linked `wikiUsername` (linked via IxnayID).

Additionally, to eliminate duplicate helper code, we will consolidate the shared write operations (e.g. `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners`, and `cleanHtmlForParsoid`) from the 7 split tRPC router files into a single helper module.

---

## Technical Details

### 1. Simplify `getUserSessionAndToken` in `src/lib/wiki-os/csrf-cache.ts`
* **File:** [csrf-cache.ts](file:///ixwiki/public/projects/ixstats/src/lib/wiki-os/csrf-cache.ts)
* **Changes:**
  * Keep the initial guard that checks if the user has linked their MediaWiki account:
    ```typescript
    const { wikiUsername } = getWikiAuth(ctx);
    if (!wikiUsername) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "You must link your MediaWiki account via IxnayID before editing.",
      });
    }
    ```
  * Always return `getBotSessionAndToken()`. This bypasses forwarding cookies from the browser header entirely, simplifying the token management and avoiding CSRF issues.

### 2. Consolidated Write Service
* **File:** [NEW] `src/lib/wiki-os/wiki-write-service.ts`
* **Contents:**
  * Define `saveToMediaWiki(title, wikitext, summary, minor, ctx, basetimestamp?, isTemplateSync?)`.
  * The edit summary suffix appended to the edit comment should simply be ` (via WikiOS)` rather than ` (via WikiOS by username)`, since the edit will already be natively registered to the user's username.
  * After the Action API edit request succeeds, query the `actor_id` for the user's `wikiUsername` from the MediaWiki database.
  * If the user doesn't have an `actor_id` yet, look up their `user_id` from `user` table and create a row in the `actor` table.
  * Execute direct MySQL updates to attribute the edit to the user:
    * `UPDATE revision SET rev_actor = ? WHERE rev_id = ?`
    * `UPDATE recentchanges SET rc_actor = ?, rc_user = ?, rc_user_text = ? WHERE rc_this_oldid = ?`
    * `UPDATE logging SET log_actor = ?, log_user = ?, log_user_text = ? WHERE log_page = ? AND log_timestamp = ?`
  * Define `updateFileUploadActor(filename, wikiUsername)` to attribute file uploads to the user in the `image`, `revision`, `recentchanges`, and `logging` tables.
  * Houses helper functions: `syncCustomTemplates`, `notifyStashOwners`, `cleanHtmlForParsoid`, `getOrCreateWikiActorId`.

### 3. Update Split Router Files
* **Files:**
  * `src/server/api/routers/wikios/editing.ts`
  * `src/server/api/routers/wikios/watchlist-annotations.ts`
  * `src/server/api/routers/wikios/search-categories.ts`
  * `src/server/api/routers/wikios/stash.ts`
  * `src/server/api/routers/wikios/templates.ts`
  * `src/server/api/routers/wikios/user-talk.ts`
  * `src/server/api/routers/wikios/page-content.ts`
* **Changes:**
  * Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  * Remove local duplicate private declarations of `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners`, and `cleanHtmlForParsoid`.
  * In `editing.ts`, update `uploadFile` mutation: after a successful upload, call `updateFileUploadActor(resultFilename, wikiUsername)`.
