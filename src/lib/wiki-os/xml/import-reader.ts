/**
 * import-reader.ts — streaming reader for MediaWiki's XML export format (export-0.11 and earlier).
 *
 * `readExport(stream)` parses the dump with saxes as the chunks arrive and yields one `siteinfo`
 * event, then one `page` event per `<page>` with all of its revisions. A page's history is held in
 * memory while it is read (it always fits); nothing is kept across pages. Elements the reader does
 * not know (`<upload>` blocks, extra slots, log items, future additions) are skipped, `<upload>`
 * children of a page are only counted.
 *
 * Reading is by element path below the `<mediawiki>` root, so a `<revision>` child called `<id>`
 * is never confused with the page's own.
 */

import { StringDecoder } from "node:string_decoder";
import { SaxesParser } from "saxes";
import type { Contributor, SiteInfo, SiteInfoNamespace, XmlRevision } from "./types";

export interface ImportPage {
  title: string;
  /** `<ns>`; null when the dump does not say. */
  ns: number | null;
  /** `<id>`: the MediaWiki page id; null when absent. */
  id: number | null;
  /** The `<redirect title>` target, or null when the page is not a redirect. */
  redirectTitle: string | null;
  /** The legacy `<restrictions>` text (`edit=sysop:move=sysop`), or null. */
  restrictions: string | null;
  /** How many `<upload>` blocks the page had: counted, never imported. */
  uploads: number;
  revisions: XmlRevision[];
}

export type ImportEvent =
  { type: "siteinfo"; siteinfo: SiteInfo } | { type: "page"; page: ImportPage };

/** The root element of every export. */
const ROOT = "mediawiki";

interface ContributorDraft {
  username: string | null;
  id: number | null;
  ip: string | null;
  deleted: boolean;
}

interface TextDraft {
  bytes: number | null;
  sha1: string | null;
  deleted: boolean;
}

interface ReaderState {
  /** Names of the open elements, the root first. */
  path: string[];
  /** Text of the element being read (reset by every opening tag). */
  text: string;
  siteinfo: SiteInfo | null;
  namespace: Pick<SiteInfoNamespace, "key" | "case"> | null;
  page: ImportPage | null;
  revision: XmlRevision | null;
  contributor: ContributorDraft | null;
  textDraft: TextDraft | null;
  /** Events produced since the last drain. */
  events: ImportEvent[];
}

type Attributes = Record<string, string>;
type OpenHandler = (state: ReaderState, attributes: Attributes) => void;
type CloseHandler = (state: ReaderState, value: string) => void;

/** A whole number from an element's text or an attribute; null when it is not one. */
function parseInteger(value: string | undefined): number | null {
  if (value === undefined || !/^\s*-?\d+\s*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const blankRevision = (): XmlRevision => ({
  id: null,
  parentId: null,
  timestamp: "",
  contributor: { deleted: true },
  minor: false,
  comment: null,
  model: "wikitext",
  format: "text/x-wiki",
  text: null,
  bytes: null,
  sha1: null,
});

const blankPage = (): ImportPage => ({
  title: "",
  ns: null,
  id: null,
  redirectTitle: null,
  restrictions: null,
  uploads: 0,
  revisions: [],
});

const blankSiteInfo = (): SiteInfo => ({
  sitename: "",
  dbname: "",
  base: "",
  generator: "",
  case: "first-letter",
  namespaces: [],
});

function contributorFrom(draft: ContributorDraft): Contributor {
  if (draft.deleted) return { deleted: true };
  if (draft.ip !== null) return { ip: draft.ip };
  if (draft.username !== null) return { username: draft.username, id: draft.id };
  return { deleted: true };
}

/** Set one field of the siteinfo being read. */
const siteInfoField =
  (field: "sitename" | "dbname" | "base" | "generator" | "case"): CloseHandler =>
  (state, value) => {
    if (state.siteinfo) state.siteinfo[field] = value;
  };

/** Set one field of the page being read. */
const pageField =
  (apply: (page: ImportPage, value: string) => void): CloseHandler =>
  (state, value) => {
    if (state.page) apply(state.page, value);
  };

/** Set one field of the revision being read. */
const revisionField =
  (apply: (revision: XmlRevision, value: string) => void): CloseHandler =>
  (state, value) => {
    if (state.revision) apply(state.revision, value);
  };

/** Set one field of the contributor being read. */
const contributorField =
  (apply: (draft: ContributorDraft, value: string) => void): CloseHandler =>
  (state, value) => {
    if (state.contributor) apply(state.contributor, value);
  };

/** Handlers for an opening tag, keyed by the element's path below the root. */
const OPEN: Readonly<Record<string, OpenHandler>> = {
  siteinfo: (state) => {
    state.siteinfo = blankSiteInfo();
  },
  "siteinfo/namespaces/namespace": (state, attributes) => {
    state.namespace = { key: parseInteger(attributes.key) ?? 0, case: attributes.case ?? "" };
  },
  page: (state) => {
    state.page = blankPage();
  },
  "page/redirect": (state, attributes) => {
    if (state.page) state.page.redirectTitle = attributes.title ?? null;
  },
  "page/upload": (state) => {
    if (state.page) state.page.uploads += 1;
  },
  "page/revision": (state) => {
    state.revision = blankRevision();
  },
  "page/revision/contributor": (state, attributes) => {
    state.contributor = {
      username: null,
      id: null,
      ip: null,
      deleted: attributes.deleted !== undefined,
    };
  },
  "page/revision/text": (state, attributes) => {
    state.textDraft = {
      bytes: parseInteger(attributes.bytes),
      sha1: attributes.sha1 ?? null,
      deleted: attributes.deleted !== undefined,
    };
  },
};

/** Handlers for a closing tag (given the element's text), keyed by path below the root. */
const CLOSE: Readonly<Record<string, CloseHandler>> = {
  "siteinfo/sitename": siteInfoField("sitename"),
  "siteinfo/dbname": siteInfoField("dbname"),
  "siteinfo/base": siteInfoField("base"),
  "siteinfo/generator": siteInfoField("generator"),
  "siteinfo/case": siteInfoField("case"),
  "siteinfo/namespaces/namespace": (state, value) => {
    if (state.siteinfo && state.namespace) {
      state.siteinfo.namespaces.push({ ...state.namespace, name: value });
    }
    state.namespace = null;
  },
  siteinfo: (state) => {
    if (state.siteinfo) state.events.push({ type: "siteinfo", siteinfo: state.siteinfo });
    state.siteinfo = null;
  },

  "page/title": pageField((page, value) => {
    page.title = value;
  }),
  "page/ns": pageField((page, value) => {
    page.ns = parseInteger(value);
  }),
  "page/id": pageField((page, value) => {
    page.id = parseInteger(value);
  }),
  "page/restrictions": pageField((page, value) => {
    page.restrictions = value.trim() || null;
  }),
  page: (state) => {
    if (state.page) state.events.push({ type: "page", page: state.page });
    state.page = null;
  },

  "page/revision/id": revisionField((revision, value) => {
    revision.id = parseInteger(value);
  }),
  "page/revision/parentid": revisionField((revision, value) => {
    revision.parentId = parseInteger(value);
  }),
  "page/revision/timestamp": revisionField((revision, value) => {
    revision.timestamp = value.trim();
  }),
  "page/revision/minor": revisionField((revision) => {
    revision.minor = true;
  }),
  "page/revision/comment": revisionField((revision, value) => {
    revision.comment = value === "" ? null : value;
  }),
  "page/revision/model": revisionField((revision, value) => {
    revision.model = value.trim() || revision.model;
  }),
  "page/revision/format": revisionField((revision, value) => {
    revision.format = value.trim() || revision.format;
  }),
  "page/revision/sha1": revisionField((revision, value) => {
    revision.sha1 = value.trim() || revision.sha1;
  }),
  "page/revision/text": (state, value) => {
    const { revision, textDraft } = state;
    if (!revision || !textDraft) return;
    revision.text = textDraft.deleted ? null : value;
    revision.bytes = textDraft.bytes;
    revision.sha1 = revision.sha1 ?? textDraft.sha1;
    state.textDraft = null;
  },

  "page/revision/contributor/username": contributorField((draft, value) => {
    draft.username = value;
  }),
  "page/revision/contributor/id": contributorField((draft, value) => {
    draft.id = parseInteger(value);
  }),
  "page/revision/contributor/ip": contributorField((draft, value) => {
    draft.ip = value;
  }),
  "page/revision/contributor": (state) => {
    if (state.revision && state.contributor) {
      state.revision.contributor = contributorFrom(state.contributor);
    }
    state.contributor = null;
  },

  "page/revision": (state) => {
    if (state.page && state.revision) state.page.revisions.push(state.revision);
    state.revision = null;
  },
};

/** The element path below the root, "page/revision/id" for `<mediawiki><page><revision><id>`. */
const relativePath = (path: string[]): string => path.slice(1).join("/");

/** A saxes parser wired to `state`: feed it text, then drain `state.events`. */
function createParser(state: ReaderState): SaxesParser {
  const parser = new SaxesParser();
  parser.on("opentag", (tag) => {
    state.path.push(tag.name);
    if (state.path.length === 1 && tag.name !== ROOT) {
      throw new Error(`Not a MediaWiki export: the root element is <${tag.name}>, not <${ROOT}>`);
    }
    state.text = "";
    OPEN[relativePath(state.path)]?.(state, tag.attributes);
  });
  parser.on("text", (text) => {
    state.text += text;
  });
  parser.on("cdata", (text) => {
    state.text += text;
  });
  parser.on("closetag", () => {
    CLOSE[relativePath(state.path)]?.(state, state.text);
    state.text = "";
    state.path.pop();
  });
  return parser;
}

/** A web `ReadableStream` (an uploaded `File.stream()`, a `fetch` body) as an async iterable. */
export async function* chunksOfStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read an export dump. `stream` yields the file in pieces (strings, or UTF-8 bytes: a character
 * split across two chunks is reassembled). Throws on malformed XML or a document that is not a
 * MediaWiki export; pages yielded before the failure were complete.
 */
export async function* readExport(
  stream: AsyncIterable<string | Uint8Array>
): AsyncGenerator<ImportEvent> {
  const state: ReaderState = {
    path: [],
    text: "",
    siteinfo: null,
    namespace: null,
    page: null,
    revision: null,
    contributor: null,
    textDraft: null,
    events: [],
  };
  const parser = createParser(state);
  const decoder = new StringDecoder("utf8");

  const drain = (): ImportEvent[] => state.events.splice(0, state.events.length);

  for await (const chunk of stream) {
    parser.write(typeof chunk === "string" ? chunk : decoder.write(chunk));
    yield* drain();
  }
  parser.write(decoder.end());
  parser.close();
  yield* drain();
}
