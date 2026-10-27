/**
 * export-writer.ts — streaming writer for MediaWiki's XML export format (export-0.11).
 *
 * `createExportWriter(write, siteinfo)` hands `write` the dump a piece at a time (the header, then
 * one chunk per page header and per revision), so a whole wiki never sits in memory. The output is
 * what `Special:Export` and `dumpBackup.php` produce, and what `importDump.php`, `Special:Import`
 * and WikiOS's own importer read.
 *
 * Text is written exactly (`xml:space="preserve"`, `\r` as `&#13;` so a parser does not fold it
 * into `\n`), except for characters XML 1.0 cannot carry at all (most control characters, lone
 * surrogates): those are dropped, and `bytes` and `sha1` describe what was written.
 */

import { publicArticleUrl, wikiosConfig } from "../config";
import { NAMESPACE_CANONICAL_NAMES } from "../core/title";
import { mwSha1Base36 } from "./sha1";
import type { Contributor, SiteInfo, XmlRevision } from "./types";

export type ExportSink = (chunk: string) => void | Promise<void>;

export interface ExportPage {
  /** Canonical title, namespace prefix included. */
  title: string;
  ns: number;
  pageId: number | null;
  /** The redirect target's title when this page is a redirect. */
  redirectTitle?: string | null;
  revisions: AsyncIterable<XmlRevision> | Iterable<XmlRevision>;
}

export interface ExportWriter {
  /** Write the `<mediawiki>` opening tag and `<siteinfo>`. Call once, first. */
  start(): Promise<void>;
  /** Write one `<page>` with its revisions, in the order given. */
  page(page: ExportPage): Promise<void>;
  /** Write the closing tag. Call once, last. */
  end(): Promise<void>;
}

const EXPORT_NS = "http://www.mediawiki.org/xml/export-0.11/";
const EXPORT_XSD = "http://www.mediawiki.org/xml/export-0.11.xsd";

/** Characters XML 1.0 forbids: C0 controls except tab/LF/CR, U+FFFE/U+FFFF and unpaired surrogates. */
const XML_FORBIDDEN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const TEXT_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\r": "&#13;",
};
const ATTRIBUTE_ESCAPES: Readonly<Record<string, string>> = {
  ...TEXT_ESCAPES,
  '"': "&quot;",
  "\n": "&#10;",
  "\t": "&#9;",
};

/** `text` without the characters XML cannot carry. */
function toXmlSafe(text: string): string {
  return text.replace(XML_FORBIDDEN, "");
}

/** Element content: `& < >` escaped (and `\r`, which a parser would otherwise normalise). */
export function escapeXmlText(text: string): string {
  return toXmlSafe(text).replace(/[&<>\r]/g, (char) => TEXT_ESCAPES[char] ?? char);
}

/** Attribute value: element escapes plus `"`, tab and newline (a parser turns those into spaces). */
export function escapeXmlAttribute(text: string): string {
  return toXmlSafe(text).replace(/[&<>"\r\n\t]/g, (char) => ATTRIBUTE_ESCAPES[char] ?? char);
}

/** A `Date` in MediaWiki's dump format: `2026-01-02T03:04:05Z`, no milliseconds. */
export function toXmlTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** IxWiki's namespaces in id order, the main namespace (empty name) included. */
function ixwikiNamespaces(): SiteInfo["namespaces"] {
  const named = Object.entries(NAMESPACE_CANONICAL_NAMES).map(([key, name]) => ({
    key: Number(key),
    case: "first-letter",
    name,
  }));
  return [...named, { key: 0, case: "first-letter", name: "" }].sort((a, b) => a.key - b.key);
}

export const DEFAULT_SITEINFO: SiteInfo = {
  sitename: wikiosConfig.siteName,
  dbname: "ixwiki",
  base: publicArticleUrl("Main Page"),
  generator: "WikiOS 1",
  case: "first-letter",
  namespaces: ixwikiNamespaces(),
};

/** One output line at nesting `depth` (two spaces per level). */
const line = (depth: number, content: string): string => `${"  ".repeat(depth)}${content}\n`;

/** `<name>escaped content</name>` on one line. */
const tag = (depth: number, name: string, content: string): string =>
  line(depth, `<${name}>${escapeXmlText(content)}</${name}>`);

function siteInfoXml(info: SiteInfo): string {
  const namespaces = info.namespaces.map((ns) => {
    const attrs = `key="${ns.key}" case="${escapeXmlAttribute(ns.case)}"`;
    return ns.name === ""
      ? line(3, `<namespace ${attrs} />`)
      : line(3, `<namespace ${attrs}>${escapeXmlText(ns.name)}</namespace>`);
  });
  return [
    line(1, "<siteinfo>"),
    tag(2, "sitename", info.sitename),
    tag(2, "dbname", info.dbname),
    tag(2, "base", info.base),
    tag(2, "generator", info.generator),
    tag(2, "case", info.case),
    line(2, "<namespaces>"),
    ...namespaces,
    line(2, "</namespaces>"),
    line(1, "</siteinfo>"),
  ].join("");
}

function contributorXml(contributor: Contributor): string {
  if ("deleted" in contributor) return line(3, '<contributor deleted="deleted" />');
  const inner =
    "ip" in contributor
      ? tag(4, "ip", contributor.ip)
      : tag(4, "username", contributor.username) +
        (contributor.id === null ? "" : tag(4, "id", String(contributor.id)));
  return line(3, "<contributor>") + inner + line(3, "</contributor>");
}

/**
 * The `<text>` and `<sha1>` lines: sized and hashed from the text written, never from claims.
 * Text that is not available is an element without content: marked deleted when an administrator
 * deleted it, else just carrying the size it had (an unfilled placeholder); with neither a size
 * nor a deletion there is nothing to say and the element is left out.
 */
function textXml(rev: XmlRevision): string {
  if (rev.text === null) {
    const bytes = typeof rev.bytes === "number" ? ` bytes="${rev.bytes}"` : "";
    const sha1 = rev.sha1 ? ` sha1="${escapeXmlAttribute(rev.sha1)}"` : "";
    const deleted = rev.textDeleted ? ' deleted="deleted"' : "";
    const element = bytes || deleted || sha1 ? line(3, `<text${bytes}${sha1}${deleted} />`) : "";
    return element + (rev.sha1 ? tag(3, "sha1", rev.sha1) : "");
  }
  const text = toXmlSafe(rev.text);
  const sha1 = mwSha1Base36(text);
  const bytes = Buffer.byteLength(text, "utf8");
  return (
    line(
      3,
      `<text bytes="${bytes}" sha1="${sha1}" xml:space="preserve">${escapeXmlText(text)}</text>`
    ) + tag(3, "sha1", sha1)
  );
}

/** The `<comment>` line: the summary, a deleted marker, or nothing. */
function commentXml(rev: XmlRevision): string {
  if (rev.commentDeleted) return line(3, '<comment deleted="deleted" />');
  return rev.comment ? tag(3, "comment", rev.comment) : "";
}

function revisionXml(rev: XmlRevision): string {
  return [
    line(2, "<revision>"),
    rev.id === null ? "" : tag(3, "id", String(rev.id)),
    rev.parentId === null ? "" : tag(3, "parentid", String(rev.parentId)),
    tag(3, "timestamp", rev.timestamp),
    contributorXml(rev.contributor),
    rev.minor ? line(3, "<minor />") : "",
    commentXml(rev),
    rev.id === null ? "" : tag(3, "origin", String(rev.id)),
    tag(3, "model", rev.model),
    tag(3, "format", rev.format),
    textXml(rev),
    line(2, "</revision>"),
  ].join("");
}

function pageHeaderXml(page: ExportPage): string {
  return [
    line(1, "<page>"),
    tag(2, "title", page.title),
    tag(2, "ns", String(page.ns)),
    page.pageId === null ? "" : tag(2, "id", String(page.pageId)),
    page.redirectTitle
      ? line(2, `<redirect title="${escapeXmlAttribute(page.redirectTitle)}" />`)
      : "",
  ].join("");
}

/**
 * A writer that emits export-0.11 XML through `write`. `write` may be async (a stream's
 * back-pressure); every call is awaited before the next chunk is produced.
 */
export function createExportWriter(
  write: ExportSink,
  siteinfo: SiteInfo = DEFAULT_SITEINFO
): ExportWriter {
  return {
    async start() {
      await write(
        `<mediawiki xmlns="${EXPORT_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
          `xsi:schemaLocation="${EXPORT_NS} ${EXPORT_XSD}" version="0.11" xml:lang="en">\n` +
          siteInfoXml(siteinfo)
      );
    },
    async page(page) {
      await write(pageHeaderXml(page));
      for await (const revision of page.revisions) {
        await write(revisionXml(revision));
      }
      await write(line(1, "</page>"));
    },
    async end() {
      await write("</mediawiki>\n");
    },
  };
}
