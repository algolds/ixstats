/**
 * One imported XenForo post body as stored forum HTML (phase 4, Q2/Q6/Q7/Q17). Pure. The order is fixed, and the
 * sanitizer runs last:
 *   transformBBCode (forum links kept absolute, mentions as text, action tokens kept)
 *   → degrade what sanitizeUserContent would drop or garble (spoilers, YouTube, tables, rules, strike, colours,
 *     template syntax)
 *   → attachment placeholders replaced, the post's other attachments appended
 *   → action tokens cut out of every tag (withoutTokensInTags)
 *   → sanitizeUserContent → stripHtml.
 * Image-only bodies are kept (empty plain text), as the Realm Board archive does; prepareBody is not called.
 */
import {
  MAX_ACTIONS_PER_POST,
  countActionTokens,
  countTextActionTokens,
  mapHtmlRuns,
  parseActionTokens,
  withoutActionTokens,
  withoutTokensInTags,
} from "~/lib/action-links";
import { escapeHtml, sanitizeUserContent, stripHtml } from "~/lib/utils/sanitize-html";
import { transformBBCode } from "./bbcode";
import type { XfAttachment } from "./xenforo-types";

export interface AttachmentRender {
  kind: "image" | "link";
  url: string;
  filename: string;
}

/**
 * How one attachment renders: inline image or link, an "omitted" note, or nothing (null). The caller's policy
 * (Task 4) answers "omitted" for refused types and sizes and for snapshot entries without usable bytes (stored
 * missing, forbidden or size_mismatch).
 */
export type AttachmentOutcome = AttachmentRender | "omitted" | null;

export interface PostHtmlInput {
  message: string;
  attachments: XfAttachment[];
  attachmentFor: (id: number) => AttachmentOutcome;
}

/** What a post used that the native forum degrades, or that the owner should see counted. */
export const POST_FEATURES = [
  "spoiler",
  "youtube",
  "table",
  "hr",
  "color",
  "templateSyntax",
  "httpImage",
  "blank",
] as const;
export type PostFeature = (typeof POST_FEATURES)[number];
export type PostFeatures = Record<PostFeature, boolean>;

export interface PostHtmlResult {
  contentHtml: string;
  plainText: string;
  features: PostFeatures;
  /** kept: tokens that render (text runs). stripped: the message's other tokens. overLimit: distinct ids past the cap. */
  tokens: { kept: number; stripped: number; overLimit: number };
  attachments: { inline: number; appended: number; omitted: number };
}

// The transformer's fixed markup (bbcode.ts); user text inside it is already escaped.
const SPOILER_OPEN =
  /<details class="forum-spoiler"><summary class="forum-spoiler-toggle">([^<]*)<\/summary><div class="forum-spoiler-content">/g;
const SPOILER_CLOSE = /<\/div><\/details>/g;
const YOUTUBE =
  /<div class="forum-embed forum-embed-youtube"><iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]*)"[^>]*><\/iframe><\/div>/g;
const TABLE = /<table class="forum-table">([\s\S]*?)<\/table>/g;
const ROW = /<tr>([\s\S]*?)<\/tr>/g;
const CELL = /<t[dh]>([\s\S]*?)<\/t[dh]>/g;
const EDGE_BREAKS = /^(?:\s|<br \/>)+|(?:\s|<br \/>)+$/g;
const HR = /<hr class="forum-hr" \/>/g;
const DEL = /<(\/?)del>/g;
const STYLE_ATTR = /\s+style="[^"]*"/g;
const PLACEHOLDER = /<div class="forum-attachment" data-attachment-id="(\d+)"><\/div>/g;
// SAFE_FOR_TEMPLATES (sanitize-html.ts) blanks a text node from `{{`, `${` or `<%` to its end and from its start
// to `}}` or `%>`: a zero-width space between the two characters keeps the text. Text runs are escaped here.
const TEMPLATE_PAIR = /\{(?=\{)|\}(?=\})|\$(?=\{)|&lt;(?=%)|%(?=&gt;)/g;
const HTTP_IMAGE = /<img\b[^>]*\ssrc="http:/i;
const MAX_SANITIZE_PASSES = 3;

type Degrade = (html: string) => string;

const spoilerQuote = (_m: string, label: string) =>
  `<blockquote><p><strong>${label === "Spoiler" ? "Spoiler" : `Spoiler: ${label}`}</strong></p><div>`;

const youtubeLink = (_m: string, id: string) =>
  id ? `<p><a href="https://www.youtube.com/watch?v=${id}">YouTube video</a></p>` : "";

const cellsOf = (row: string) =>
  Array.from(row.matchAll(CELL), (cell) => cell[1]!.replace(EDGE_BREAKS, "")).join(" | ");

const tableRows = (_m: string, table: string) =>
  Array.from(table.matchAll(ROW), (row) => `<p>${cellsOf(row[1]!)}</p>`).join("");

const DEGRADES: ReadonlyArray<readonly [Exclude<PostFeature, "httpImage" | "blank">, Degrade]> = [
  [
    "spoiler",
    (h) => h.replace(SPOILER_OPEN, spoilerQuote).replace(SPOILER_CLOSE, "</div></blockquote>"),
  ],
  ["youtube", (h) => h.replace(YOUTUBE, youtubeLink)],
  ["table", (h) => h.replace(TABLE, tableRows)],
  ["hr", (h) => h.replace(HR, "")],
  ["color", (h) => mapHtmlRuns(h, { markup: (tag) => tag.replace(STYLE_ATTR, "") })],
  ["templateSyntax", (h) => mapHtmlRuns(h, { text: (text) => text.replace(TEMPLATE_PAIR, "$&​") })],
];

const noFeatures = (): PostFeatures => ({
  spoiler: false,
  youtube: false,
  table: false,
  hr: false,
  color: false,
  templateSyntax: false,
  httpImage: false,
  blank: false,
});

/** Maps the transformer's markup onto tags sanitizeUserContent keeps, noting each feature that changed the body. */
function degradeForSanitizer(html: string, features: PostFeatures): string {
  let out = html.replace(DEL, "<$1s>");
  for (const [feature, degrade] of DEGRADES) {
    const next = degrade(out);
    features[feature] = next !== out;
    out = next;
  }
  return out;
}

const fileText = (filename: string) => escapeHtml(withoutActionTokens(filename));

function attachmentBlock(attachment: XfAttachment, outcome: AttachmentOutcome): string {
  if (outcome === null) return "";
  if (outcome === "omitted") return `<p>[attachment omitted: ${fileText(attachment.filename)}]</p>`;
  const url = escapeHtml(outcome.url);
  return outcome.kind === "image"
    ? `<p><img src="${url}" alt="${fileText(outcome.filename)}"></p>`
    : `<p><a href="${url}">${fileText(outcome.filename)}</a></p>`;
}

type AttachmentCounts = PostHtmlResult["attachments"];

function count(
  counts: AttachmentCounts,
  outcome: AttachmentOutcome,
  placed: "inline" | "appended"
): void {
  if (outcome === "omitted") counts.omitted += 1;
  else if (outcome) counts[placed] += 1;
}

/**
 * Placeholders become the attachment (only the post's own: another post's attachment is never pulled in), and
 * placeholders that render as nothing are removed; the post's attachments not placed inline follow under
 * "Attachments".
 */
function withAttachments(html: string, input: PostHtmlInput, counts: AttachmentCounts): string {
  const own = new Map(input.attachments.map((a) => [a.attachment_id, a]));
  const placed = new Set<number>();
  const body = html.replace(PLACEHOLDER, (_m, id: string) => {
    const attachment = own.get(Number(id));
    if (!attachment) return "";
    placed.add(attachment.attachment_id);
    const outcome = input.attachmentFor(attachment.attachment_id);
    count(counts, outcome, "inline");
    return attachmentBlock(attachment, outcome);
  });
  const appended = [...own.values()]
    .filter((a) => !placed.has(a.attachment_id))
    .map((a) => {
      const outcome = input.attachmentFor(a.attachment_id);
      count(counts, outcome, "appended");
      return attachmentBlock(a, outcome);
    })
    .filter(Boolean);
  return appended.length ? `${body}<p>Attachments</p>${appended.join("")}` : body;
}

/**
 * Sanitized last. DOMPurify decodes entities in attribute values, so `&#91;ixaction=a&#93;` in an href becomes a
 * token inside a tag: cut and sanitize again until no token is left in markup.
 */
function sanitizedLast(html: string): string {
  let stored = sanitizeUserContent(withoutTokensInTags(html));
  for (let pass = 1; countTextActionTokens(stored) !== countActionTokens(stored); pass += 1) {
    if (pass >= MAX_SANITIZE_PASSES)
      throw new Error("An imported post kept an action token inside markup");
    stored = sanitizeUserContent(withoutTokensInTags(stored));
  }
  return stored;
}

export function importedPostBody(input: PostHtmlInput): PostHtmlResult {
  const features = noFeatures();
  const attachments: AttachmentCounts = { inline: 0, appended: 0, omitted: 0 };
  const transformed = transformBBCode(input.message, {
    forumLinks: "keep",
    mentions: "text",
    actionTokens: "keep",
  }).contentHtml;
  const degraded = degradeForSanitizer(transformed, features);
  const contentHtml = sanitizedLast(withAttachments(degraded, input, attachments));
  const plainText = stripHtml(contentHtml);
  features.httpImage = HTTP_IMAGE.test(contentHtml);
  features.blank = !plainText && !/<img\b/i.test(contentHtml);
  const kept = countTextActionTokens(contentHtml);
  return {
    contentHtml,
    plainText,
    features,
    tokens: {
      kept,
      stripped: Math.max(0, countActionTokens(input.message) - kept),
      overLimit: Math.max(0, parseActionTokens(contentHtml).length - MAX_ACTIONS_PER_POST),
    },
    attachments,
  };
}
