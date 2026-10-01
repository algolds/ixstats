/**
 * query-meta.ts — `action=query&meta=siteinfo|userinfo|tokens` (plan 410).
 *
 * Pywikibot reads these first: `siteinfo` for the wiki's version, namespaces and extensions,
 * `tokens` for a login and an edit token, `userinfo` to check that the login took and what the
 * account may do. Everything a bot parses keeps MediaWiki's key names.
 */

import {
  TOKEN_TYPES,
  expectedToken,
  type TokenType,
} from "../auth";
import { mwTimestamp, type JsonObject, type JsonValue } from "../format";
import { NAMESPACE_CANONICAL_NAMES } from "~/lib/wiki-os/core/title";
import { GROUP_RIGHTS, changeableGroups, type Group } from "~/lib/wiki-os/rights";
import { MEDIAWIKI_TARGET_VERSION, wikiosConfig } from "~/lib/wiki-os/config";
import type { ApiContext } from "../types";
import { loginTokenFor } from "./login";

// ---------------------------------------------------------------------------
// siteinfo
// ---------------------------------------------------------------------------

export const SITE_NAME = wikiosConfig.siteName;
/** The script path api.php lives under (the endpoint is `/w/api.php`). */
export const SCRIPT_PATH = "/w";
export const MAX_ARTICLE_SIZE = 2_097_152;

const SITEINFO_PROPS = [
  "general",
  "namespaces",
  "namespacealiases",
  "statistics",
  "interwikimap",
  "magicwords",
  "extensions",
  "rightsinfo",
  "usergroups",
  "restrictions",
  "fileextensions",
] as const;
type SiteinfoProp = (typeof SITEINFO_PROPS)[number];

/** MediaWiki's default legal title characters, which Pywikibot reads to split links. */
const LEGAL_TITLE_CHARS = " %!\"$&'()*,\\-.\\/0-9:;=?@A-Z\\\\^_`a-z~\\x80-\\xFF+";

/** Namespaces where subpages are on in a stock MediaWiki: every talk namespace, User, Project, MediaWiki, Help. */
const SUBPAGE_NAMESPACES: ReadonlySet<number> = new Set([2, 4, 8, 12]);
const namespaceHasSubpages = (id: number) => id >= 0 && (id % 2 === 1 || SUBPAGE_NAMESPACES.has(id));

/** Names MediaWiki accepts for a namespace besides its own. */
const NAMESPACE_ALIASES: ReadonlyArray<{ id: number; alias: string }> = [
  { id: 4, alias: "Project" },
  { id: 5, alias: "Project talk" },
  { id: 6, alias: "Image" },
  { id: 7, alias: "Image talk" },
];

/** The magic words a bot reads (Pywikibot builds its redirect pattern from `redirect`). */
const MAGIC_WORDS: ReadonlyArray<{ name: string; aliases: string[]; caseSensitive: boolean }> = [
  { name: "redirect", aliases: ["#REDIRECT"], caseSensitive: false },
  { name: "notoc", aliases: ["__NOTOC__"], caseSensitive: false },
  { name: "toc", aliases: ["__TOC__"], caseSensitive: false },
  { name: "forcetoc", aliases: ["__FORCETOC__"], caseSensitive: false },
  { name: "nogallery", aliases: ["__NOGALLERY__"], caseSensitive: false },
  { name: "noeditsection", aliases: ["__NOEDITSECTION__"], caseSensitive: false },
  { name: "newsectionlink", aliases: ["__NEWSECTIONLINK__"], caseSensitive: false },
  { name: "nonewsectionlink", aliases: ["__NONEWSECTIONLINK__"], caseSensitive: false },
  { name: "hiddencat", aliases: ["__HIDDENCAT__"], caseSensitive: false },
  { name: "index", aliases: ["__INDEX__"], caseSensitive: false },
  { name: "noindex", aliases: ["__NOINDEX__"], caseSensitive: false },
  { name: "staticredirect", aliases: ["__STATICREDIRECT__"], caseSensitive: false },
  { name: "displaytitle", aliases: ["DISPLAYTITLE"], caseSensitive: false },
  { name: "defaultsort", aliases: ["DEFAULTSORT", "DEFAULTSORTKEY", "DEFAULTCATEGORYSORT"], caseSensitive: false },
  { name: "pagename", aliases: ["PAGENAME"], caseSensitive: true },
  { name: "fullpagename", aliases: ["FULLPAGENAME"], caseSensitive: true },
  { name: "namespace", aliases: ["NAMESPACE"], caseSensitive: true },
  { name: "subst", aliases: ["SUBST:"], caseSensitive: false },
];

/** What the private renderer provides; WikiOS itself implements none of them. */
const EXTENSIONS: readonly string[] = [
  "ParserFunctions",
  "Scribunto",
  "Cite",
  "TemplateStyles",
  "TemplateData",
];

const FILE_EXTENSIONS = ["png", "gif", "jpg", "jpeg", "webp", "svg", "pdf", "ogg", "webm", "mp3"];

function namespaceEntry(id: number, version: ApiContext["version"]): JsonObject {
  const name = id === 0 ? "" : (NAMESPACE_CANONICAL_NAMES[id] ?? "");
  return {
    id,
    case: "first-letter",
    ...(version === 1 ? { "*": name } : { name }),
    ...(id === 0 ? {} : { canonical: name }),
    subpages: namespaceHasSubpages(id),
    content: id === 0,
    nonincludable: false,
  };
}

function namespaces(version: ApiContext["version"]): JsonObject {
  const ids = [0, ...Object.keys(NAMESPACE_CANONICAL_NAMES).map(Number)].sort((a, b) => a - b);
  return Object.fromEntries(ids.map((id) => [String(id), namespaceEntry(id, version)]));
}

function namespaceAliases(version: ApiContext["version"]): JsonValue[] {
  return NAMESPACE_ALIASES.map(({ id, alias }) =>
    version === 1 ? { id, "*": alias } : { id, alias }
  );
}

function general(rc: ApiContext): JsonObject {
  const server = rc.deps.siteUrl;
  return {
    mainpage: "Main Page",
    base: `${server}/wiki/Main_Page`,
    sitename: SITE_NAME,
    mainpageisdomainroot: false,
    // Pywikibot parses the version out of this string: "MediaWiki 1.45.1" must come first.
    generator: `MediaWiki ${MEDIAWIKI_TARGET_VERSION} (WikiOS)`,
    case: "first-letter",
    lang: "en",
    legaltitlechars: LEGAL_TITLE_CHARS,
    linkprefixcharset: "",
    maxarticlesize: MAX_ARTICLE_SIZE,
    timezone: "UTC",
    timeoffset: 0,
    articlepath: "/wiki/$1",
    scriptpath: SCRIPT_PATH,
    script: `${SCRIPT_PATH}/index.php`,
    variantarticlepath: false,
    server,
    servername: new URL(server).host,
    wikiid: "ixwiki",
    time: mwTimestamp(rc.now),
    writeapi: true,
    uploadsenabled: false,
    interwikimagic: true,
    categorycollation: "uppercase",
    langconversion: false,
    titleconversion: false,
  };
}

async function siteinfoProp(rc: ApiContext, prop: SiteinfoProp): Promise<[string, JsonValue]> {
  switch (prop) {
    case "general":
      return ["general", general(rc)];
    case "namespaces":
      return ["namespaces", namespaces(rc.version)];
    case "namespacealiases":
      return ["namespacealiases", namespaceAliases(rc.version)];
    case "statistics": {
      const stats = await rc.deps.store.statistics();
      return [
        "statistics",
        {
          pages: stats.pages,
          articles: stats.articles,
          edits: stats.edits,
          images: stats.images,
          users: stats.users,
          activeusers: stats.activeUsers,
          admins: stats.admins,
          jobs: 0,
        },
      ];
    }
    case "interwikimap":
      return ["interwikimap", []];
    case "magicwords":
      return [
        "magicwords",
        MAGIC_WORDS.map((word) => ({
          name: word.name,
          aliases: word.aliases,
          "case-sensitive": word.caseSensitive,
        })),
      ];
    case "extensions":
      return [
        "extensions",
        EXTENSIONS.map((name) => ({
          type: "parserhook",
          name,
          description: "Provided by WikiOS's private renderer (via renderer)",
        })),
      ];
    case "rightsinfo":
      return ["rightsinfo", { url: "", text: "" }];
    case "usergroups":
      return ["usergroups", usergroups()];
    case "restrictions":
      return [
        "restrictions",
        {
          types: ["create", "edit", "move", "upload"],
          levels: ["", "autoconfirmed", "sysop"],
          cascadinglevels: ["sysop"],
          semiprotectedlevels: ["autoconfirmed"],
        },
      ];
    case "fileextensions":
      return [
        "fileextensions",
        FILE_EXTENSIONS.map((ext) => (rc.version === 1 ? { ext } : { extension: ext })),
      ];
  }
}

function usergroups(): JsonValue[] {
  const groups = Object.keys(GROUP_RIGHTS) as Group[];
  return groups.map((name) => ({ name, rights: [...GROUP_RIGHTS[name]] }));
}

export async function metaSiteinfo(rc: ApiContext): Promise<JsonObject> {
  const p = rc.params.scope("si", "siteinfo");
  const props = p.listOf("prop", SITEINFO_PROPS, ["general"]);
  const entries = await Promise.all(props.map((prop) => siteinfoProp(rc, prop)));
  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// userinfo
// ---------------------------------------------------------------------------

const USERINFO_PROPS = [
  "blockinfo",
  "hasmsg",
  "groups",
  "implicitgroups",
  "rights",
  "changeablegroups",
  "editcount",
  "registrationdate",
  "ratelimits",
  "realname",
  "email",
  "options",
  "unreadcount",
  "centralids",
  "latestcontrib",
] as const;

const IMPLICIT_GROUPS: ReadonlySet<string> = new Set(["*", "user", "autoconfirmed"]);

export async function metaUserinfo(rc: ApiContext): Promise<JsonObject> {
  const { session } = rc;
  const props = new Set(rc.params.scope("ui", "userinfo").listOf("prop", USERINFO_PROPS));
  const { permissions } = session;
  const anonymous = session.kind === "anonymous";
  const info: JsonObject = { id: session.userId, name: session.name, ...(anonymous ? { anon: true } : {}) };

  if (props.has("blockinfo") && permissions.block) {
    const { block } = permissions;
    Object.assign(info, {
      blockid: 0,
      blockedby: "",
      blockedbyid: 0,
      blockreason: block.reason ?? "",
      blockexpiry: block.expiresAt ? mwTimestamp(block.expiresAt) : "infinite",
      blockpartial: false,
    });
  }
  if (props.has("hasmsg")) info.messages = false;
  if (props.has("groups")) info.groups = permissions.groups.filter((g) => !IMPLICIT_GROUPS.has(g));
  if (props.has("implicitgroups")) info.implicitgroups = permissions.groups.filter((g) => IMPLICIT_GROUPS.has(g));
  if (props.has("rights")) info.rights = [...permissions.rights];
  if (props.has("changeablegroups")) {
    const changeable = changeableGroups(permissions.rights);
    info.changeablegroups = { add: [...changeable], remove: [...changeable], "add-self": [], "remove-self": [] };
  }
  if (props.has("ratelimits")) info.ratelimits = {};
  if (props.has("editcount") || props.has("registrationdate")) {
    const stats = anonymous
      ? { editCount: 0, registration: null }
      : await rc.deps.store.userStats(session.ctx.user?.id ?? null, session.name);
    if (props.has("editcount")) info.editcount = stats.editCount;
    if (props.has("registrationdate")) {
      info.registrationdate = stats.registration ? mwTimestamp(stats.registration) : null;
    }
  }
  return { userinfo: info };
}

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------

export function metaTokens(rc: ApiContext): JsonObject {
  const types = rc.params.scope("", "tokens").listOf("type", TOKEN_TYPES, ["csrf"]);
  const tokens: JsonObject = {};
  for (const type of types) tokens[`${type}token`] = tokenOf(rc, type);
  return { tokens };
}

function tokenOf(rc: ApiContext, type: TokenType): string {
  return type === "login" ? loginTokenFor(rc) : expectedToken(rc.session, type);
}
