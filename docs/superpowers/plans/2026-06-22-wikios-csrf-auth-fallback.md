# WikiOS Native Edits via Database Actor Rewriting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify WikiOS MediaWiki authentication by executing edits/uploads via the system bot session, and natively attribute them by rewriting the revision/upload authors directly in the MediaWiki MySQL database.

**Architecture:** Consolidate duplicated MediaWiki write helpers into a new `wiki-write-service.ts` file, update `csrf-cache.ts` to always return the bot credentials when a user has a linked wiki username, and execute MySQL update queries to swap the revision/upload actor in the database immediately after Action API calls succeed.

**Tech Stack:** TypeScript, Node.js, Next.js, MySQL (mysql2/promise), tRPC (v11), Prisma (v6).

## Global Constraints

- **Package manager**: `bun` exclusively (never npm/yarn/pnpm). Lockfile: `bun.lock`.
- **Active branch**: `v2`.
- **Database writes**: Direct MySQL writes to the MediaWiki database are required, but standard PostgreSQL `db:migrate`/`db:push` writes are not affected.
- **TypeScript checks**: Never run global `tsc --noEmit`. Use `bun run typecheck:server` to check routers/libs.

---

### Task 1: Create the Unified Wiki Write Service and MySQL Actor-Rewriting Helpers

**Files:**
- Create: `src/lib/wiki-os/wiki-write-service.ts`
- Modify: `src/lib/wiki-os/csrf-cache.ts`

**Interfaces:**
- Consumes:
  - `getWikiAuth(ctx: WikiAuthContext): WikiAuthIdentity` (from `src/lib/wiki-os/auth.ts`)
  - `getWikiActorLabel(ctx: WikiAuthContext): string` (from `src/lib/wiki-os/auth.ts`)
  - `getBotSessionAndToken(): Promise<{ cookies: string[]; csrfToken: string }>` (from `src/lib/wiki-os/csrf-cache.ts`)
  - `getWikiDbPool(): Pool` (from `src/lib/wiki-bridge.ts`)
  - `invalidateCache(title: string): void` (from `src/lib/wiki-os/parsoid-client.ts`)
  - `recordArticleRevision(rev: any): Promise<boolean>` (from `src/lib/wiki-os/article-store.ts`)
  - `invalidateArticleShadow(title: string): Promise<void>` (from `src/lib/wiki-os/article-store.ts`)
- Produces:
  - `getOrCreateWikiActorId(pool: Pool, wikiUsername: string): Promise<number | null>`
  - `updateRevisionActor(revid: number, wikiUsername: string): Promise<boolean>`
  - `updateFileUploadActor(filename: string, wikiUsername: string): Promise<boolean>`
  - `saveToMediaWiki(title: string, wikitext: string, summary: string, minor: boolean, ctx: any, basetimestamp?: string, isTemplateSync?: boolean): Promise<{ success: boolean; revisionId: number | null; editConflict?: boolean }>`
  - `cleanHtmlForParsoid(html: string): string`
  - `notifyStashOwners(pageTitle: string, editorUserId: string | null | undefined, revisionId: number | null): Promise<void>`
  - `syncCustomTemplates(wikitext: string, ctx: any): Promise<void>`

- [ ] **Step 1: Simplify `getUserSessionAndToken` in `csrf-cache.ts` to always use bot session**
  Modify [csrf-cache.ts](file:///ixwiki/public/projects/ixstats/src/lib/wiki-os/csrf-cache.ts):
  ```typescript
  export async function getUserSessionAndToken(ctx: {
    user: any;
    auth: { userId: string | null };
    headers: Headers;
  }): Promise<{ cookies: string[]; csrfToken: string }> {
    const { wikiUsername } = getWikiAuth(ctx);
    if (!wikiUsername) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "You must link your MediaWiki account via IxnayID before editing.",
      });
    }
    // Always use the bot session for Action API calls
    return getBotSessionAndToken();
  }
  ```

- [ ] **Step 2: Create the `wiki-write-service.ts` file**
  Create [wiki-write-service.ts](file:///ixwiki/public/projects/ixstats/src/lib/wiki-os/wiki-write-service.ts) with the following content:
  ```typescript
  import { getWikiAuth } from "~/lib/wiki-os/auth";
  import { getWikiDbPool } from "~/lib/wiki-bridge";
  import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";
  import { invalidateCache } from "~/lib/wiki-os/parsoid-client";
  import { invalidateArticleShadow, recordArticleRevision } from "~/lib/wiki-os/article-store";
  import { db } from "~/server/db";
  import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
  import { resolveWikiPlaceholdersInternal } from "~/server/api/routers/wiki";
  import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

  export async function getOrCreateWikiActorId(pool: Pool, wikiUsername: string): Promise<number | null> {
    const [actorRows] = await pool.execute<RowDataPacket[]>(
      "SELECT actor_id FROM actor WHERE actor_name = ? LIMIT 1",
      [wikiUsername]
    );
    if (actorRows && actorRows.length > 0) {
      return actorRows[0]!.actor_id as number;
    }

    const [userRows] = await pool.execute<RowDataPacket[]>(
      "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
      [wikiUsername]
    );
    if (!userRows || userRows.length === 0) {
      console.error(`[WikiWriteService] MediaWiki user "${wikiUsername}" not found in user table`);
      return null;
    }
    const userId = userRows[0]!.user_id as number;

    try {
      const [insertResult] = await pool.execute<ResultSetHeader>(
        "INSERT INTO actor (actor_user, actor_name) VALUES (?, ?)",
        [userId, wikiUsername]
      );
      return insertResult.insertId;
    } catch (err: any) {
      const [retryRows] = await pool.execute<RowDataPacket[]>(
        "SELECT actor_id FROM actor WHERE actor_name = ? LIMIT 1",
        [wikiUsername]
      );
      if (retryRows && retryRows.length > 0) {
        return retryRows[0]!.actor_id as number;
      }
      console.error("[WikiWriteService] Failed to create actor row:", err);
      return null;
    }
  }

  export async function updateRevisionActor(revid: number, wikiUsername: string): Promise<boolean> {
    const pool = getWikiDbPool() as Pool;
    try {
      const actorId = await getOrCreateWikiActorId(pool, wikiUsername);
      if (!actorId) return false;

      const [userRows] = await pool.execute<RowDataPacket[]>(
        "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
        [wikiUsername]
      );
      const userId = userRows && userRows.length > 0 ? (userRows[0]!.user_id as number) : 0;

      await pool.execute("UPDATE revision SET rev_actor = ? WHERE rev_id = ?", [actorId, revid]);
      await pool.execute(
        "UPDATE recentchanges SET rc_actor = ?, rc_user = ?, rc_user_text = ? WHERE rc_this_oldid = ?",
        [actorId, userId, wikiUsername, revid]
      );

      const [revRows] = await pool.execute<RowDataPacket[]>(
        "SELECT rev_page, rev_timestamp FROM revision WHERE rev_id = ? LIMIT 1",
        [revid]
      );
      if (revRows && revRows.length > 0) {
        const pageId = revRows[0]!.rev_page as number;
        const timestamp = revRows[0]!.rev_timestamp as string;

        await pool.execute(
          "UPDATE logging SET log_actor = ?, log_user = ?, log_user_text = ? WHERE log_page = ? AND log_timestamp = ?",
          [actorId, userId, wikiUsername, pageId, timestamp]
        );
      }

      console.log(`[WikiWriteService] Updated revision ${revid} actor to "${wikiUsername}"`);
      return true;
    } catch (err) {
      console.error(`[WikiWriteService] Failed to update revision ${revid} actor:`, err);
      return false;
    }
  }

  export async function updateFileUploadActor(filename: string, wikiUsername: string): Promise<boolean> {
    const pool = getWikiDbPool() as Pool;
    try {
      const actorId = await getOrCreateWikiActorId(pool, wikiUsername);
      if (!actorId) return false;

      const [userRows] = await pool.execute<RowDataPacket[]>(
        "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
        [wikiUsername]
      );
      const userId = userRows && userRows.length > 0 ? (userRows[0]!.user_id as number) : 0;

      const dbFilename = filename.replace(/ /g, "_");
      await pool.execute(
        "UPDATE image SET img_actor = ?, img_user = ?, img_user_text = ? WHERE img_name = ?",
        [actorId, userId, wikiUsername, dbFilename]
      );

      const [pageRows] = await pool.execute<RowDataPacket[]>(
        "SELECT page_id, page_latest FROM page WHERE page_title = ? AND page_namespace = 6 LIMIT 1",
        [dbFilename]
      );
      if (pageRows && pageRows.length > 0) {
        const pageId = pageRows[0]!.page_id as number;
        const latestRev = pageRows[0]!.page_latest as number;

        await pool.execute("UPDATE revision SET rev_actor = ? WHERE rev_id = ?", [actorId, latestRev]);
        await pool.execute(
          "UPDATE recentchanges SET rc_actor = ?, rc_user = ?, rc_user_text = ? WHERE rc_this_oldid = ?",
          [actorId, userId, wikiUsername, latestRev]
        );
        await pool.execute(
          "UPDATE logging SET log_actor = ?, log_user = ?, log_user_text = ? WHERE log_namespace = 6 AND log_title = ?",
          [actorId, userId, wikiUsername, dbFilename]
        );
      }

      console.log(`[WikiWriteService] Updated file upload "${filename}" actor to "${wikiUsername}"`);
      return true;
    } catch (err) {
      console.error(`[WikiWriteService] Failed to update file upload "${filename}" actor:`, err);
      return false;
    }
  }

  export function cleanHtmlForParsoid(html: string): string {
    let cleaned = html;
    cleaned = cleaned.replace(
      /<a[^>]*href="([^"]*Coords[^"]*)"[^>]*>(?:<span[^>]*>📍<\/span>)?\s*(.*?)<\/a>/gi,
      (match: string, href: string, label: string) => {
        const cleanLabel = label.replace(/📍/g, "").trim();
        return `<a href="${href}">${cleanLabel}</a>`;
      }
    );
    cleaned = cleaned.replace(
      /<a[^>]*href="([^"]*MapEmbed[^"]*)"[^>]*>(?:<span[^>]*>🗺️<\/span>)?\s*(.*?)<\/a>/gi,
      (match: string, href: string, label: string) => {
        const cleanLabel = label.replace(/🗺️/g, "").trim();
        return `<a href="${href}">${cleanLabel}</a>`;
      }
    );
    return cleaned;
  }

  export async function notifyStashOwners(
    pageTitle: string,
    editorUserId: string | null | undefined,
    revisionId: number | null
  ): Promise<void> {
    const stashItems = await db.loreStashItem.findMany({
      where: { pageTitle },
      include: { stash: { select: { userId: true } } },
    });

    const userIds = [...new Set(stashItems.map((i) => i.stash.userId))].filter(
      (uid) => uid !== editorUserId
    );

    if (userIds.length === 0) return;

    const pageSlug = encodeURIComponent(pageTitle.replace(/ /g, "_"));
    const href = revisionId
      ? `/wiki/diff?from=${revisionId - 1}&to=${revisionId}`
      : `/wiki/${pageSlug}`;

    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: `"${pageTitle}" was edited`,
        description: `A page in your stash was updated.`,
        type: "wiki_edit",
        category: "wiki",
        href,
        metadata: JSON.stringify({ pageTitle, revisionId }),
      })),
    });
  }

  export async function syncCustomTemplates(wikitext: string, ctx: any): Promise<void> {
    const regex = /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi;
    const placeholders = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(wikitext)) !== null) {
      if (match[1]) {
        placeholders.add(match[1]);
      }
    }

    if (placeholders.size === 0) return;

    const keys = Array.from(placeholders);
    const activeCountryId = (await resolveActiveCountryId(ctx)) ?? undefined;
    const resolved = await resolveWikiPlaceholdersInternal(keys, ctx, activeCountryId);

    for (const key of keys) {
      const data = resolved[key];
      const valStr = data ? data.value : "N/A";
      const normalizedKey = key.replace(/ /g, "_");
      const templateTitle = `Template:${normalizedKey}`;
      const templateWikitext = `<span class="wikios-stat-placeholder" data-key="${normalizedKey}">${valStr}</span>`;

      try {
        let currentContent = "";
        try {
          const [rows] = await (getWikiDbPool() as Pool).execute<RowDataPacket[]>(
            `SELECT t.old_text FROM page p
             JOIN slots s ON s.slot_revision_id = p.page_latest
             JOIN content c ON c.content_id = s.slot_content_id
             JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
             WHERE p.page_title = ? AND p.page_namespace = 10 LIMIT 1`,
            [templateTitle.replace(/ /g, "_")]
          );
          if (rows && rows.length > 0) {
            currentContent = String(rows[0]!.old_text);
          }
        } catch (_err) {}

        if (currentContent.trim() !== templateWikitext.trim()) {
          await saveToMediaWiki(
            templateTitle,
            templateWikitext,
            "Update dynamic stat template value",
            true,
            ctx,
            undefined,
            true
          );
        }
      } catch (err: any) {
        console.error(`[WikiWriteService] Failed to sync template ${templateTitle}:`, err.message);
      }
    }
  }

  export async function saveToMediaWiki(
    title: string,
    wikitext: string,
    summary: string,
    minor: boolean,
    ctx: any,
    basetimestamp?: string,
    isTemplateSync = false
  ): Promise<{ success: boolean; revisionId: number | null; editConflict?: boolean }> {
    const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
    const { cookies, csrfToken } = await getUserSessionAndToken(ctx);
    const { wikiUsername } = getWikiAuth(ctx);

    const editParams = new URLSearchParams({
      action: "edit",
      title,
      text: wikitext,
      summary: `${summary} (via WikiOS)`,
      token: csrfToken,
      format: "json",
    });
    if (minor) editParams.set("minor", "1");
    if (basetimestamp) {
      editParams.set("basetimestamp", basetimestamp);
      editParams.set("starttimestamp", new Date().toISOString());
    }

    const editRes = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies.join("; "),
      },
      body: editParams.toString(),
    });

    const editData = (await editRes.json()) as {
      edit?: { result: string; newrevid?: number };
      error?: { code: string; info: string };
    };

    if (editData.error) {
      if (editData.error.code === "editconflict") {
        return { success: false, revisionId: null, editConflict: true };
      }
      if (editData.error.code === "badtoken") {
        invalidateCsrfToken();
      }
      throw new Error(`MediaWiki edit failed: ${editData.error.info}`);
    }

    const revId = editData.edit?.newrevid ?? null;

    if (revId && wikiUsername) {
      await updateRevisionActor(revId, wikiUsername);
    }

    invalidateCache(title);

    const { userId } = getWikiAuth(ctx);
    const editor = wikiUsername ?? userId;
    void recordArticleRevision({
      title,
      wikitext,
      mwRevId: revId,
      author: editor,
      summary,
      minor,
    }).then((ok) => {
      if (!ok) void invalidateArticleShadow(title);
    });

    notifyStashOwners(title, userId, revId).catch((err: unknown) => {
      console.error("[WikiWriteService] Background op failed:", (err as Error).message);
    });

    if (!isTemplateSync && editData.edit?.result === "Success") {
      syncCustomTemplates(wikitext, ctx).catch((err) => {
        console.error("[WikiWriteService] Background template sync failed:", err);
      });
    }

    return {
      success: editData.edit?.result === "Success",
      revisionId: revId,
    };
  }
  ```

- [ ] **Step 3: Run typecheck on server package to make sure new service resolves correctly**
  Run: `bun run typecheck:server`
  Expected: Success or standard preexisting errors

- [ ] **Step 4: Commit new service and simplified csrf-cache**
  ```bash
  git add src/lib/wiki-os/csrf-cache.ts src/lib/wiki-os/wiki-write-service.ts
  git commit -m "feat: add wiki-write-service and update csrf-cache to always use bot session"
  ```

---

### Task 2: Refactor the 7 Split Router Files to Use the Consolidated Wiki Write Service

**Files:**
- Modify: `src/server/api/routers/wikios/editing.ts`
- Modify: `src/server/api/routers/wikios/watchlist-annotations.ts`
- Modify: `src/server/api/routers/wikios/search-categories.ts`
- Modify: `src/server/api/routers/wikios/stash.ts`
- Modify: `src/server/api/routers/wikios/templates.ts`
- Modify: `src/server/api/routers/wikios/user-talk.ts`
- Modify: `src/server/api/routers/wikios/page-content.ts`

**Interfaces:**
- Consumes:
  - `saveToMediaWiki` (from `~/lib/wiki-os/wiki-write-service`)
  - `cleanHtmlForParsoid` (from `~/lib/wiki-os/wiki-write-service`)
  - `updateFileUploadActor` (from `~/lib/wiki-os/wiki-write-service`)

- [ ] **Step 1: Refactor `editing.ts`**
  Modify [editing.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/editing.ts):
  - Import `saveToMediaWiki`, `cleanHtmlForParsoid`, `updateFileUploadActor` from `~/lib/wiki-os/wiki-write-service`.
  - Remove helper functions `saveToMediaWiki`, `cleanHtmlForParsoid`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.
  - In `uploadFile` mutation, retrieve the user's `wikiUsername` using `getWikiAuth(ctx)`:
    ```typescript
    const { wikiUsername } = getWikiAuth(ctx);
    ```
  - After a successful file upload, call `updateFileUploadActor`:
    ```typescript
    if (uploadData.upload?.result === "Success" && wikiUsername) {
      await updateFileUploadActor(uploadData.upload.filename ?? input.filename, wikiUsername);
    }
    ```

- [ ] **Step 2: Refactor `watchlist-annotations.ts`**
  Modify [watchlist-annotations.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/watchlist-annotations.ts):
  - Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  - Remove private helper functions `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.

- [ ] **Step 3: Refactor `search-categories.ts`**
  Modify [search-categories.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/search-categories.ts):
  - Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  - Remove private helper functions `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.

- [ ] **Step 4: Refactor `stash.ts`**
  Modify [stash.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/stash.ts):
  - Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  - Remove private helper functions `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.

- [ ] **Step 5: Refactor `templates.ts`**
  Modify [templates.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/templates.ts):
  - Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  - Remove private helper functions `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.

- [ ] **Step 6: Refactor `user-talk.ts`**
  Modify [user-talk.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/user-talk.ts):
  - Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  - Remove private helper functions `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.

- [ ] **Step 7: Refactor `page-content.ts`**
  Modify [page-content.ts](file:///ixwiki/public/projects/ixstats/src/server/api/routers/wikios/page-content.ts):
  - Import `saveToMediaWiki` from `~/lib/wiki-os/wiki-write-service`.
  - Remove private helper functions `saveToMediaWiki`, `syncCustomTemplates`, `notifyStashOwners` from the bottom.

- [ ] **Step 8: Run typecheck check to verify all router files build**
  Run: `bun run typecheck:server`
  Expected: PASS

- [ ] **Step 9: Commit the router cleanup**
  ```bash
  git add src/server/api/routers/wikios/*.ts
  git commit -m "refactor: consolidate saveToMediaWiki calls and clean up split router files"
  ```

---

### Task 3: Verification and Integration Testing

**Files:**
- Modify: `src/server/api/routers/wikios/editing.ts` (adding tests / temporary sandbox verification if needed)

- [ ] **Step 1: Verify the changes by running existing tests**
  Run: `bun run test`
  Expected: PASS (or normal baseline test passes)

- [ ] **Step 2: Run dev server and perform manual verification**
  Run: `bun run dev`
  Verify that we can perform wiki edits. Edits should save successfully and show up in MediaWiki's revision history under the logged-in user's name with the `(via WikiOS)` comment.
