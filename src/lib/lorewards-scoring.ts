/**
 * lorewards-scoring.ts — WikiOS Lorewards Scoring Engine.
 *
 * Independent scoring system that runs alongside the Discord bot.
 * Uses 5 quality signals beyond raw byte count to better match panelist judgment.
 * All data from direct MediaWiki MySQL queries — no API calls, no LLM.
 */

import * as mysql from "mysql2/promise";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ScoringWeights {
  proseWeight: number; // Weight in prose multiplier formula (default 0.7)
  collaborativeBonus: number; // Multiplier for cross-country edits (default 1.3)
  depthMaxBonus: number; // Max bonus for edit depth (default 0.3)
  noveltyBonus: number; // Multiplier for new article creation (default 1.2)
  importanceMaxBonus: number; // Max bonus for inlink count (default 0.2)
  listPenalty: number; // Multiplier for "List of..." articles (default 0.3)
  minorOnlyPenalty: number; // Multiplier for all-minor edits (default 0.2)
  minSingleEdit: number; // Min bytes for winner qualification (default 1000)
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  proseWeight: 0.7,
  collaborativeBonus: 1.3,
  depthMaxBonus: 0.3,
  noveltyBonus: 1.2,
  importanceMaxBonus: 0.2,
  listPenalty: 0.3,
  minorOnlyPenalty: 0.2,
  minSingleEdit: 1000,
};

export interface CandidateScore {
  user: string;
  page: string;
  pageId: number;
  bytesAdded: number;
  largestEdit: number;
  editCount: number;
  isMinorOnly: boolean;
  // Quality signals
  proseRatio: number;
  proseMultiplier: number;
  isCollaborative: boolean;
  collaborativeMultiplier: number;
  editDepth: number;
  depthMultiplier: number;
  isNewArticle: boolean;
  noveltyMultiplier: number;
  inlinkCount: number;
  importanceMultiplier: number;
  // Final
  finalScore: number;
  scoreBreakdown: string;
}

export interface WikiOSScoringResult {
  date: string;
  winner: CandidateScore | null;
  runnerUp: CandidateScore | null;
  candidates: CandidateScore[];
  editCount: number;
  weights: ScoringWeights;
}

// ---------------------------------------------------------------------------
// MySQL Pool (reuse pattern from lorewards-sync.ts)
// ---------------------------------------------------------------------------

let pool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.IXWIKI_DB_HOST || "localhost",
      port: Number(process.env.IXWIKI_DB_PORT) || 3306,
      user: process.env.IXWIKI_DB_USER || "ixwiki",
      password: process.env.IXWIKI_DB_PASSWORD || "",
      database: process.env.IXWIKI_DB_NAME || "ixwiki",
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return pool;
}

// Home country cache: username → most-edited country category
const homeCountryCache = new Map<string, string | null>();

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export async function scoreDailyWikiOS(
  dateStr: string,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Promise<WikiOSScoringResult> {
  const db = getPool();

  // 1. Fetch all revisions for the day
  const tsStart = dateStr.replace(/-/g, "") + "000000";
  const tsEnd = dateStr.replace(/-/g, "") + "235959";

  const [revRows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT r.rev_id, r.rev_page, r.rev_len, r.rev_parent_id, r.rev_minor_edit,
            r.rev_timestamp, a.actor_id, a.actor_name,
            p.page_title, p.page_id,
            COALESCE(p2.rev_len, 0) as parent_len
     FROM revision r
     JOIN actor a ON a.actor_id = r.rev_actor
     JOIN page p ON p.page_id = r.rev_page
     LEFT JOIN revision p2 ON p2.rev_id = r.rev_parent_id
     WHERE p.page_namespace = 0
       AND r.rev_timestamp BETWEEN ? AND ?
       AND a.actor_name NOT LIKE '%Bot'
       AND a.actor_name NOT LIKE '%bot'
     ORDER BY r.rev_timestamp ASC`,
    [tsStart, tsEnd]
  );

  const editCount = revRows.length;

  // 2. Aggregate by user|page
  const aggMap = new Map<
    string,
    {
      user: string;
      page: string;
      pageId: number;
      actorId: number;
      bytesAdded: number;
      largestEdit: number;
      editCount: number;
      isMinorOnly: boolean;
      revIds: number[];
      hasNewArticle: boolean; // rev_parent_id IS NULL for any revision
    }
  >();

  for (const row of revRows) {
    const user = String(row.actor_name);
    const page = String(row.page_title).replace(/_/g, " ");
    const key = `${user}|${page}`;
    const diff = (row.rev_len as number) - (row.parent_len as number);

    if (!aggMap.has(key)) {
      aggMap.set(key, {
        user,
        page,
        pageId: row.page_id as number,
        actorId: row.actor_id as number,
        bytesAdded: 0,
        largestEdit: 0,
        editCount: 0,
        isMinorOnly: true,
        revIds: [],
        hasNewArticle: row.rev_parent_id === null,
      });
    }

    const entry = aggMap.get(key)!;
    if (diff > 0) entry.bytesAdded += diff;
    if (diff > entry.largestEdit) entry.largestEdit = diff;
    entry.editCount++;
    entry.revIds.push(row.rev_id as number);
    if (!row.rev_minor_edit) entry.isMinorOnly = false;
    if (row.rev_parent_id === null) entry.hasNewArticle = true;
  }

  // Filter trivial entries
  let candidates = Array.from(aggMap.values()).filter((e) => e.bytesAdded >= 100);
  candidates.sort((a, b) => b.bytesAdded - a.bytesAdded);

  // 3. Enrich top 10 with quality signals
  const top = candidates.slice(0, 10);
  const enriched: CandidateScore[] = [];

  for (const c of top) {
    const [prose, collab, depth, inlinks] = await Promise.all([
      analyzeProseRatio(db, c.revIds, c.pageId),
      isCollaborativeEdit(db, c.actorId, c.pageId),
      getEditDepth(db, c.actorId, c.pageId),
      getInlinkCount(db, c.page),
    ]);

    const proseMultiplier = 1 - weights.proseWeight + prose * weights.proseWeight;
    const collaborativeMultiplier = collab ? weights.collaborativeBonus : 1.0;
    const depthMultiplier = 1.0 + Math.min(depth / 20, weights.depthMaxBonus);
    const noveltyMultiplier = c.hasNewArticle ? weights.noveltyBonus : 1.0;
    const importanceMultiplier = 1.0 + Math.min(inlinks / 200, weights.importanceMaxBonus);

    let score = c.bytesAdded;

    // Apply penalties (same as bot)
    const isList = /^Lists? of /i.test(c.page);
    if (isList) score *= weights.listPenalty;
    if (c.isMinorOnly && c.largestEdit < weights.minSingleEdit) score *= weights.minorOnlyPenalty;

    // Apply quality multipliers (WikiOS-only signals)
    score *= proseMultiplier;
    score *= collaborativeMultiplier;
    score *= depthMultiplier;
    score *= noveltyMultiplier;
    score *= importanceMultiplier;

    score = Math.round(score);

    const parts = [`base:${c.bytesAdded}`];
    if (proseMultiplier < 0.95) parts.push(`prose:${proseMultiplier.toFixed(2)}x`);
    if (collab) parts.push(`collab:${collaborativeMultiplier}x`);
    if (depth > 0) parts.push(`depth:${depthMultiplier.toFixed(2)}x(${depth}revs)`);
    if (c.hasNewArticle) parts.push(`new:${noveltyMultiplier}x`);
    if (inlinks > 10) parts.push(`imp:${importanceMultiplier.toFixed(2)}x(${inlinks}links)`);
    if (isList) parts.push(`list:${weights.listPenalty}x`);

    enriched.push({
      user: c.user,
      page: c.page,
      pageId: c.pageId,
      bytesAdded: c.bytesAdded,
      largestEdit: c.largestEdit,
      editCount: c.editCount,
      isMinorOnly: c.isMinorOnly,
      proseRatio: prose,
      proseMultiplier,
      isCollaborative: collab,
      collaborativeMultiplier,
      editDepth: depth,
      depthMultiplier,
      isNewArticle: c.hasNewArticle,
      noveltyMultiplier,
      inlinkCount: inlinks,
      importanceMultiplier,
      finalScore: score,
      scoreBreakdown: parts.join(" · "),
    });
  }

  // Add remaining candidates with base scoring only
  for (const c of candidates.slice(10)) {
    let score = c.bytesAdded;
    if (/^Lists? of /i.test(c.page)) score *= weights.listPenalty;
    if (c.isMinorOnly && c.largestEdit < weights.minSingleEdit) score *= weights.minorOnlyPenalty;

    enriched.push({
      user: c.user,
      page: c.page,
      pageId: c.pageId,
      bytesAdded: c.bytesAdded,
      largestEdit: c.largestEdit,
      editCount: c.editCount,
      isMinorOnly: c.isMinorOnly,
      proseRatio: -1,
      proseMultiplier: 1,
      isCollaborative: false,
      collaborativeMultiplier: 1,
      editDepth: 0,
      depthMultiplier: 1,
      isNewArticle: false,
      noveltyMultiplier: 1,
      inlinkCount: 0,
      importanceMultiplier: 1,
      finalScore: Math.round(score),
      scoreBreakdown: `base:${c.bytesAdded} (unenriched)`,
    });
  }

  // Sort by final score
  enriched.sort((a, b) => b.finalScore - a.finalScore);

  // Select winner and runner-up
  let winner: CandidateScore | null = null;
  let runnerUp: CandidateScore | null = null;

  for (const c of enriched) {
    if (c.finalScore <= 0) continue;
    if (!winner && c.largestEdit >= weights.minSingleEdit && !/^Lists? of /i.test(c.page)) {
      winner = c;
      continue;
    }
    if (!runnerUp && (!winner || c.user !== winner.user)) {
      runnerUp = c;
      break;
    }
  }

  return {
    date: dateStr,
    winner,
    runnerUp,
    candidates: enriched.slice(0, 10),
    editCount,
    weights,
  };
}

// ---------------------------------------------------------------------------
// Signal 1: Prose Ratio — classify added wikitext as prose vs structural
// ---------------------------------------------------------------------------

async function analyzeProseRatio(
  db: mysql.Pool,
  revIds: number[],
  pageId: number
): Promise<number> {
  if (revIds.length === 0) return 0;

  // Get the revision with the largest positive diff
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT r.rev_id, r.rev_len, COALESCE(p2.rev_len, 0) as parent_len,
            r.rev_parent_id
     FROM revision r
     LEFT JOIN revision p2 ON p2.rev_id = r.rev_parent_id
     WHERE r.rev_id IN (${revIds.map(() => "?").join(",")})
     ORDER BY (CAST(r.rev_len AS SIGNED) - COALESCE(CAST(p2.rev_len AS SIGNED), 0)) DESC
     LIMIT 1`,
    revIds
  );

  if (!rows[0] || !rows[0].rev_parent_id) return 0.5; // New article — assume mixed

  const revId = rows[0].rev_id as number;
  const parentId = rows[0].rev_parent_id as number;

  // Fetch both revision texts
  const [texts] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT r.rev_id, t.old_text
     FROM revision r
     JOIN slots s ON s.slot_revision_id = r.rev_id
     JOIN content c ON c.content_id = s.slot_content_id
     JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
     WHERE r.rev_id IN (?, ?)`,
    [parentId, revId]
  );

  if (texts.length < 2) return 0.5;

  const oldText = String(texts.find((t) => t.rev_id === parentId)?.old_text ?? "");
  const newText = String(texts.find((t) => t.rev_id === revId)?.old_text ?? "");

  // Simple diff: lines in new but not in old
  const oldLines = new Set(oldText.split("\n"));
  const addedLines = newText.split("\n").filter((l) => !oldLines.has(l) && l.trim().length > 0);

  if (addedLines.length === 0) return 0.5;

  let proseLines = 0;
  for (const line of addedLines) {
    const trimmed = line.trim();
    // Structural/template lines
    if (/^[|{}*#!]/.test(trimmed)) continue;
    if (/^\[\[Category:/i.test(trimmed)) continue;
    if (/^\[\[File:/i.test(trimmed)) continue;
    if (/^<ref/i.test(trimmed)) continue;
    if (trimmed.length < 20) continue;
    proseLines++;
  }

  return proseLines / addedLines.length;
}

// ---------------------------------------------------------------------------
// Signal 2: Collaborative Edit — is this a cross-country contribution?
// ---------------------------------------------------------------------------

async function isCollaborativeEdit(
  db: mysql.Pool,
  actorId: number,
  pageId: number
): Promise<boolean> {
  // Get article's country categories
  const articleCountry = await getArticleCountry(db, pageId);
  if (!articleCountry) return false; // Can't determine, no bonus

  // Get editor's home country
  const editorCountry = await getEditorHomeCountry(db, actorId);
  if (!editorCountry) return false; // Can't determine

  return articleCountry !== editorCountry;
}

async function getArticleCountry(db: mysql.Pool, pageId: number): Promise<string | null> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT lt.lt_title
     FROM categorylinks cl
     JOIN linktarget lt ON lt.lt_id = cl.cl_target_id AND lt.lt_namespace = 14
     WHERE cl.cl_from = ?`,
    [pageId]
  );

  // Look for country-like categories (pages in categories with many members)
  for (const row of rows) {
    const cat = String(row.lt_title);
    // Skip generic categories
    if (/^(Pages_|Articles_|IXWB|All_|Lorewards)/.test(cat)) continue;
    // Return the first substantive category as a proxy for "country"
    return cat;
  }
  return null;
}

async function getEditorHomeCountry(db: mysql.Pool, actorId: number): Promise<string | null> {
  // Check cache first
  const cacheKey = String(actorId);
  if (homeCountryCache.has(cacheKey)) return homeCountryCache.get(cacheKey) ?? null;

  // Find the category the user edits most frequently
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT lt.lt_title, COUNT(*) as cnt
     FROM revision r
     JOIN page p ON p.page_id = r.rev_page
     JOIN categorylinks cl ON cl.cl_from = p.page_id
     JOIN linktarget lt ON lt.lt_id = cl.cl_target_id AND lt.lt_namespace = 14
     WHERE r.rev_actor = ?
       AND p.page_namespace = 0
       AND lt.lt_title NOT REGEXP '^(Pages_|Articles_|IXWB|All_|Lorewards)'
     GROUP BY lt.lt_title
     ORDER BY cnt DESC
     LIMIT 1`,
    [actorId]
  );

  const country = rows[0] ? String(rows[0].lt_title) : null;
  homeCountryCache.set(cacheKey, country);
  return country;
}

// ---------------------------------------------------------------------------
// Signal 3: Edit Depth — how many previous revisions to this article?
// ---------------------------------------------------------------------------

async function getEditDepth(db: mysql.Pool, actorId: number, pageId: number): Promise<number> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM revision WHERE rev_page = ? AND rev_actor = ?`,
    [pageId, actorId]
  );
  return (rows[0]?.cnt as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Signal 5: Article Importance — inbound link count
// ---------------------------------------------------------------------------

async function getInlinkCount(db: mysql.Pool, pageTitle: string): Promise<number> {
  const title = pageTitle.replace(/ /g, "_");
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as cnt
     FROM pagelinks pl
     JOIN linktarget lt ON lt.lt_id = pl.pl_target_id
     WHERE lt.lt_namespace = 0 AND lt.lt_title = ?`,
    [title]
  );
  return (rows[0]?.cnt as number) ?? 0;
}
