/**
 * A small MediaWiki that keeps state, on top of the scripted api.php of fake-mediawiki.ts, for the scenario tests that
 * run the mirror and the inbound sync against each other: pages with their revisions (text, author, time, parent),
 * recent changes and log events, files. It answers the reads the inbound sync and the mirror make (`prop=revisions` by
 * title or revid, `prop=imageinfo`, `list=recentchanges`, `list=logevents`) and the writes the mirror makes
 * (`action=import` of an export-0.11 file, `action=edit`, `action=upload`), as MediaWiki would:
 *   - an import adds the revisions it carries (an older one goes into the history, not on top) and a null revision by
 *     the importing account, dated now; neither shows in recent changes (an import is a log entry there);
 *   - an edit by anyone is a new revision on top of the current one, and a recent change;
 *   - an upload stores the file's SHA-1 and creates the file page when it is missing.
 * `editAs`, `deletePage` and `restorePage` are the editors working on MediaWiki directly.
 */
import { createHash } from "node:crypto";
import { createFakeMediaWiki, type RecordedRequest } from "./fake-mediawiki";

export interface SiteRevision {
  revid: number;
  parentid: number;
  text: string;
  user: string;
  comment: string;
  timestamp: string;
  minor: boolean;
}

export interface SitePage {
  pageid: number;
  ns: number;
  title: string;
  revisions: SiteRevision[];
  fileSha1: string | null;
}

interface RecentChange {
  type: "edit" | "new";
  title: string;
  revid: number;
  old_revid: number;
  timestamp: string;
  user: string;
}

interface SiteLogEvent {
  logid: number;
  type: string;
  action: string;
  title: string;
  user: string;
  timestamp: string;
  comment: string;
  params: Record<string, unknown>;
}

const hex = (text: string | Uint8Array) => createHash("sha1").update(text).digest("hex");

const unescapeXml = (text: string) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&");

const tag = (xml: string, name: string) => {
  const match = new RegExp(`<${name}(?: [^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? unescapeXml(match[1]!) : null;
};

/** The revisions of each page of an export-0.11 document, as the mirror writes one. */
function readExport(xml: string) {
  return [...xml.matchAll(/<page>([\s\S]*?)<\/page>/g)].map(([, page]) => ({
    title: tag(page!, "title") ?? "",
    ns: Number(tag(page!, "ns") ?? 0),
    revisions: [...page!.matchAll(/<revision>([\s\S]*?)<\/revision>/g)].map(([, revision]) => ({
      timestamp: tag(revision!, "timestamp") ?? "",
      user: tag(revision!, "username") ?? tag(revision!, "ip") ?? "",
      comment: tag(revision!, "comment") ?? "",
      text: tag(revision!, "text") ?? "",
      minor: /<minor\s*\/>/.test(revision!),
    })),
  }));
}

export interface FakeMediaWikiSiteOptions {
  /** The mirror's bot-password login name; its account is the part before the `@`. */
  mirrorAccount?: string;
  /** Where the site clock starts (default: an hour ago, to the second: WikiOS's own writes come after). */
  now?: string;
}

export function createFakeMediaWikiSite(options: FakeMediaWikiSiteOptions = {}) {
  const wiki = createFakeMediaWiki();
  const mirror = options.mirrorAccount ?? "WikiOSMirror";
  const pages = new Map<string, SitePage>();
  /** Deleted pages, kept as MediaWiki keeps them (unreadable) until a restore. */
  const deleted = new Map<string, SitePage>();
  const recentChanges: RecentChange[] = [];
  const logEvents: SiteLogEvent[] = [];
  const failing = new Set<number>();
  let nextRevid = 100;
  let nextPageid = 1;
  let nextLogid = 1;
  let clock = options.now ? Date.parse(options.now) : Math.floor(Date.now() / 1000) * 1000 - 3_600_000;

  /**
   * The time of a write made now: a second after the site's last write, and after every revision it holds (an import
   * brings revisions dated by WikiOS's clock; what MediaWiki writes after them is later still).
   */
  const tick = () => {
    const newest = Math.max(
      clock,
      ...[...pages.values()].flatMap((page) => page.revisions.map((revision) => Date.parse(revision.timestamp)))
    );
    clock = Math.floor(newest / 1000) * 1000 + 1000;
    return new Date(clock).toISOString().replace(/\.\d{3}Z$/, "Z");
  };
  const byTime = (a: SiteRevision, b: SiteRevision) =>
    a.timestamp === b.timestamp ? a.revid - b.revid : a.timestamp < b.timestamp ? -1 : 1;
  const current = (page: SitePage | undefined) =>
    page ? [...page.revisions].sort(byTime).at(-1) : undefined;

  function pageOf(title: string, ns = 0): SitePage {
    let page = pages.get(title);
    if (!page) {
      page = { pageid: nextPageid++, ns, title, revisions: [], fileSha1: null };
      pages.set(title, page);
    }
    return page;
  }

  /** A new revision on top of the page's current one; `inRecentChanges` for an edit (not for an import). */
  function addRevision(
    title: string,
    revision: Omit<SiteRevision, "revid" | "parentid">,
    inRecentChanges: boolean,
    ns = 0
  ): SiteRevision {
    const page = pageOf(title, ns);
    const parent = current(page);
    const added = { ...revision, revid: nextRevid++, parentid: parent?.revid ?? 0 };
    page.revisions.push(added);
    if (inRecentChanges) {
      recentChanges.push({
        type: parent ? "edit" : "new",
        title,
        revid: added.revid,
        old_revid: parent?.revid ?? 0,
        timestamp: added.timestamp,
        user: added.user,
      });
    }
    return added;
  }

  const revisionJson = (revision: SiteRevision, withContent: boolean) => ({
    revid: revision.revid,
    parentid: revision.parentid,
    timestamp: revision.timestamp,
    user: revision.user,
    comment: revision.comment,
    minor: revision.minor,
    sha1: hex(revision.text),
    size: Buffer.byteLength(revision.text),
    ...(withContent ? { slots: { main: { content: revision.text, contentmodel: "wikitext" } } } : {}),
  });

  function findRevision(revid: number): { page: SitePage; revision: SiteRevision } | null {
    for (const page of pages.values()) {
      const revision = page.revisions.find((candidate) => candidate.revid === revid);
      if (revision) return { page, revision };
    }
    return null;
  }

  /** `list=recentchanges` / `list=logevents` from a mark: oldest first with `dir=newer`, else the newest first. */
  function listFrom<T extends { timestamp: string }>(entries: T[], params: Record<string, string>, prefix: string) {
    const limit = Number(params[`${prefix}limit`] ?? 50);
    const start = params[`${prefix}start`];
    const ordered =
      params[`${prefix}dir`] === "newer"
        ? entries.filter((entry) => !start || entry.timestamp >= start)
        : [...entries].reverse();
    return ordered.slice(0, limit);
  }

  function query(request: RecordedRequest): object {
    const { params } = request;
    if (params.list === "recentchanges") {
      return { query: { recentchanges: listFrom(recentChanges, params, "rc") } };
    }
    if (params.list === "logevents") {
      return { query: { logevents: listFrom(logEvents, params, "le") } };
    }
    if (params.prop === "imageinfo") {
      const page = pages.get(params.titles ?? "");
      return {
        query: {
          pages: [
            page?.fileSha1
              ? { title: page.title, imageinfo: [{ sha1: page.fileSha1 }] }
              : { title: params.titles, missing: true },
          ],
        },
      };
    }
    const withContent = (params.rvprop ?? "").includes("content");
    if (params.revids) {
      const revid = Number(params.revids);
      const found = findRevision(revid);
      if (!found) return { query: { badrevids: { [revid]: { revid } } } };
      return {
        query: {
          pages: [{ pageid: found.page.pageid, ns: found.page.ns, title: found.page.title, revisions: [revisionJson(found.revision, withContent)] }],
        },
      };
    }
    const page = pages.get(params.titles ?? "");
    const head = current(page);
    if (!page || !head) return { query: { pages: [{ title: params.titles, missing: true }] } };
    const newestFirst = [...page.revisions].sort(byTime).reverse();
    const listed = params.rvlimit === "max" ? newestFirst : newestFirst.slice(0, Number(params.rvlimit ?? 1));
    return {
      query: {
        pages: [
          {
            pageid: page.pageid,
            ns: page.ns,
            title: page.title,
            revisions: listed.map((revision) => revisionJson(revision, withContent)),
          },
        ],
      },
    };
  }

  wiki.on("query", query);
  wiki.on("import", ({ file }) => {
    const imported = readExport(file?.content ?? "");
    for (const page of imported) {
      for (const revision of page.revisions) addRevision(page.title, revision, false, page.ns);
      const head = current(pages.get(page.title))!;
      addRevision(
        page.title,
        { text: head.text, user: mirror, comment: `${page.revisions.length} revisions imported`, timestamp: tick(), minor: true },
        false,
        page.ns
      );
    }
    return { import: imported.map((page) => ({ ns: page.ns, title: page.title, revisions: page.revisions.length })) };
  });
  wiki.on("edit", ({ params }) => {
    const title = params.title ?? "";
    const head = current(pages.get(title));
    if (head && head.text === params.text) {
      return { edit: { result: "Success", title, nochange: true, oldrevid: head.revid } };
    }
    const added = addRevision(
      title,
      { text: params.text ?? "", user: mirror, comment: params.summary ?? "", timestamp: tick(), minor: params.minor !== undefined },
      true
    );
    return { edit: { result: "Success", title, newrevid: added.revid, oldrevid: added.parentid } };
  });
  wiki.on("upload", ({ params, file }) => {
    const title = `File:${params.filename}`;
    const page = pageOf(title, 6);
    page.fileSha1 = hex(file?.bytes ?? new Uint8Array());
    if (!current(page)) {
      addRevision(title, { text: params.text ?? "", user: mirror, comment: params.comment ?? "", timestamp: tick(), minor: false }, true, 6);
    }
    return { upload: { result: "Success", filename: params.filename } };
  });

  /** `fetch` that answers a failing revision with HTTP 500, and everything else from the site. */
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const revids = new URL(String(input)).searchParams.get("revids");
    if (revids && failing.has(Number(revids))) return new Response("{}", { status: 500 });
    return wiki.fetch(input, init);
  };

  return {
    wiki,
    fetch,
    pages,
    mirror,
    /** The page's revision MediaWiki shows as current. */
    current: (title: string) => current(pages.get(title)),
    /** An editor working on MediaWiki: a new revision on top of the current one. */
    editAs(user: string, title: string, text: string, comment = "edit") {
      return addRevision(title, { text, user, comment, timestamp: tick(), minor: false }, true);
    },
    /** A page an administrator deleted on MediaWiki: gone, and a log event. */
    deletePage(user: string, title: string, comment = "spam") {
      const page = pages.get(title);
      if (page) deleted.set(title, page);
      pages.delete(title);
      logEvents.push({ logid: nextLogid++, type: "delete", action: "delete", title, user, timestamp: tick(), comment, params: {} });
    },
    /** A deleted page an administrator restored: back with its revisions (same ids), and a log event. */
    restorePage(user: string, title: string, comment = "restored") {
      const page = deleted.get(title);
      if (page) pages.set(title, page);
      deleted.delete(title);
      logEvents.push({ logid: nextLogid++, type: "delete", action: "restore", title, user, timestamp: tick(), comment, params: {} });
    },
    /** The revision answers HTTP 500 until `recover`. */
    failRevision: (revid: number) => failing.add(revid),
    recover: (revid: number) => failing.delete(revid),
    /** The site clock, as MediaWiki writes a timestamp (for marks). */
    now: () => new Date(clock).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}
