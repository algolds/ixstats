# Design Document: WikiOS Direct SQL Engine & Universal MediaWiki SQL Integration

**Date**: 2026-08-18  
**Status**: Approved  
**Scope**: MediaWiki Database Access, WikiOS Data Loading, Timestamp Standardization

---

## 1. Overview & Objectives

IxStates and IxWiki reside on the same server in production and connect to the live MediaWiki MariaDB/MySQL database (`ixwiki`). Rather than relying on HTTP API calls or external fallbacks, all IxWiki data operations across the codebase must tap directly into the MediaWiki SQL database with universal coverage, high performance (<10ms per query), and end-to-end TypeScript type safety.

### Goals
1. **Universal Direct-SQL MediaWiki Engine**: All IxWiki queries (recent changes, site statistics, search, random pages, category trees, page history, backlinks, redirects) execute directly against the MariaDB/MySQL database.
2. **Reliable Connection Lifecycle**: Eliminate false offline latches, configure resilient connection pooling with auto-reconnect, and standardize environment resolution (`IXWIKI_DB_HOST`, `IXWIKI_DB_PORT`, `IXWIKI_DB_USER`, `IXWIKI_DB_PASSWORD`, `IXWIKI_DB_NAME`).
3. **Strict TypeScript Types**: Implement typed database row interfaces and eliminate loose `any` casts.
4. **Normalized Timestamp Serialization**: Convert raw MediaWiki 14-digit timestamps (`YYYYMMDDHHmmss`) directly into ISO 8601 strings (`YYYY-MM-DDTHH:mm:ssZ`) at the SQL boundary in `bridge.ts`.
5. **Robust UI State Handling**: Fix timestamp parsing and loading/empty states on `/wiki/recent-changes` and `WikiOSMainPage`.

---

## 2. Architecture & Database Layer

### 2.1 Connection Pool Configuration (`src/lib/wiki/bridge.ts` & `src/lib/wiki/mysql-client.ts`)
- **Connection Configuration**:
  ```typescript
  host: process.env.IXWIKI_DB_HOST || "localhost",
  port: Number(process.env.IXWIKI_DB_PORT) || 3306,
  user: process.env.IXWIKI_DB_USER || "ixwiki",
  password: process.env.IXWIKI_DB_PASSWORD || "Multico1!",
  database: process.env.IXWIKI_DB_NAME || "ixwiki",
  ```
- **Pool Settings**:
  - `waitForConnections: true`
  - `connectionLimit: 10`
  - `maxIdle: 4`
  - `idleTimeout: 60000`
  - `enableKeepAlive: true`
  - `keepAliveInitialDelay: 10000`
  - `connectTimeout: 5000`
- **Error Handling**:
  - Remove the global 5-minute `isWikiDbOffline` lockout latch that previously returned empty arrays `[[], []]`.
  - Let MySQL connection pool handle individual connection recycling and emit structured warning/error logs on failure.

---

## 3. Strongly-Typed Schemas & SQL Operations

### 3.1 TypeScript Row Interfaces
```typescript
import type { RowDataPacket } from "mysql2/promise";

export interface MWRecentChangeRow extends RowDataPacket {
  rc_id: number;
  rc_timestamp: string | Buffer;
  rc_title: string | Buffer;
  rc_type: number;
  rc_minor: number;
  rc_bot: number;
  rc_old_len: number;
  rc_new_len: number;
  actor_name: string | null;
  rc_comment: string | null;
}

export interface MWSiteStatsRow extends RowDataPacket {
  ss_total_pages: number;
  ss_good_articles: number;
  ss_total_edits: number;
  ss_images: number;
  ss_users: number;
  ss_active_users: number;
}

export interface MWPageRow extends RowDataPacket {
  page_id: number;
  page_title: string | Buffer;
  page_len: number;
  page_namespace: number;
  page_is_redirect: number;
  page_latest: number;
}

export interface MWRevisionRow extends RowDataPacket {
  rev_id: number;
  rev_page: number;
  rev_parent_id: number | null;
  rev_timestamp: string | Buffer;
  rev_len: number;
  rev_minor_edit: number;
  actor_name: string | null;
  comment_text: string | null;
}

export interface MWCategoryMemberRow extends RowDataPacket {
  page_id: number;
  page_title: string | Buffer;
  page_namespace: number;
  page_len: number;
  cl_type: string;
}
```

### 3.2 SQL Queries

1. **Recent Changes (`ixwikiRecentChanges`)**:
   ```sql
   SELECT rc.rc_id, rc.rc_timestamp, rc.rc_title, rc.rc_type,
          rc.rc_old_len, rc.rc_new_len,
          COALESCE(a.actor_name, 'Unknown') AS actor_name,
          COALESCE(c.comment_text, '') AS rc_comment
   FROM recentchanges rc
   LEFT JOIN actor a ON a.actor_id = rc.rc_actor
   LEFT JOIN comment c ON c.comment_id = rc.rc_comment_id
   WHERE rc.rc_namespace = 0 AND rc.rc_bot = 0 AND rc.rc_deleted = 0
   ORDER BY rc.rc_timestamp DESC
   LIMIT ?
   ```

2. **Site Statistics (`ixwikiGetSiteStats`)**:
   ```sql
   SELECT ss_total_pages, ss_good_articles, ss_total_edits,
          ss_images, ss_users, ss_active_users
   FROM site_stats
   LIMIT 1
   ```

3. **Search Pages (`ixwikiSearch`)**:
   ```sql
   SELECT page_id, page_title, page_len
   FROM page
   WHERE page_namespace = 0
     AND page_is_redirect = 0
     AND (
       page_title LIKE ?
       OR CONVERT(page_title USING utf8mb4) LIKE ?
     )
   ORDER BY
     CASE WHEN page_title LIKE ? THEN 0 ELSE 1 END,
     page_len DESC
   LIMIT ?
   ```

4. **Random Page (`ixwikiGetRandomPage`)**:
   Indexed lookup using `page_random >= ?` with wrap-around fallback.

5. **Page History (`ixwikiGetHistory`)**:
   ```sql
   SELECT r.rev_id, r.rev_parent_id, r.rev_timestamp, r.rev_len, r.rev_minor_edit,
          COALESCE(a.actor_name, 'Unknown') AS actor_name,
          COALESCE(c.comment_text, '') AS comment_text
   FROM revision r
   JOIN page p ON p.page_id = r.rev_page
   LEFT JOIN actor a ON a.actor_id = r.rev_actor
   LEFT JOIN comment c ON c.comment_id = r.rev_comment_id
   WHERE p.page_title = ? AND p.page_namespace = 0
   ORDER BY r.rev_timestamp DESC
   LIMIT ?
   ```

6. **Category Members (`ixwikiGetCategoryMembers`)**:
   ```sql
   SELECT p.page_id, p.page_title, p.page_namespace, p.page_len, cl.cl_type
   FROM categorylinks cl
   JOIN page p ON p.page_id = cl.cl_from
   WHERE cl.cl_to = ?
   ORDER BY cl.cl_sortkey
   LIMIT ?
   ```

---

## 4. Timestamp Normalization & Frontend Integration

### 4.1 Boundary Timestamp Normalization
- All raw MediaWiki 14-digit timestamps (`20260818180734`) are formatted to ISO 8601 strings (`2026-08-18T18:07:34Z`) at the `bridge.ts` output boundary.
- `parseMWTimestamp` in `src/lib/wiki-os/mediawiki-timestamp.ts` handles:
  - 14-digit strings (`YYYYMMDDHHmmss`)
  - ISO 8601 strings (`YYYY-MM-DDTHH:mm:ssZ`)
  - Numeric epoch timestamps
  - Date objects

### 4.2 UI Improvements
- **`src/app/(wiki-os)/wiki/recent-changes/page.tsx`**:
  - Replace local slice-based parser with `parseMWTimestamp`.
  - Fix date range filter cutoffs for all presets (24h, 3d, 7d, 30d, All).
  - Cleanly display empty states and total page/edit counts.
- **`src/components/wiki-os/reader/WikiOSMainPage.tsx`**:
  - Render recent changes list with delta byte indicators, author badges, and relative times.
  - Show proper fallback text if no recent changes are returned.

---

## 5. Verification Plan

1. **Unit & Query Verification**:
   - Verify SQL queries execute and return typed rows without runtime syntax or collation errors.
   - Verify timestamp formatting transforms 14-digit strings into ISO strings.
2. **tRPC Router Verification**:
   - Verify `api.wikios.getRecentChanges` returns valid array of changes.
   - Verify `api.wikios.getSiteStats` returns populated statistics.
   - Verify `api.wikios.search` returns matching article titles.
3. **UI Verification**:
   - Verify `/wiki/recent-changes` loads, groups by page, expands/collapses edits, and filters by time range.
   - Verify `/wiki/Main_Page` displays live site stats and recent activity.
