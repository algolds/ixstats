// src/lib/wiki-os/transformers/inert-dom.ts
// Parse article HTML into an inert DOM fragment, to change it with DOM APIs instead of regexes.
//
// The HTML the reader holds is already sanitized, and string surgery on sanitized HTML is not safe:
// the sanitizer's serializer leaves `<` and `>` unescaped inside attribute values, so a regex that
// looks for `<a ...>(.*?)</a>` or a matching `</div>` can be made to end inside an attribute and
// publish the rest of it as live markup. The DOM cannot be fooled that way.
//
// The fragment is a <template>'s content: nothing in it loads, runs or fires an event handler, and
// that holds only while it stays there. Nodes are made in the template's own (inert) document and
// the result is serialized with `template.innerHTML`; nothing is ever adopted into the live page.

export interface InertFragment {
  /** Serialize with `template.innerHTML`. */
  template: HTMLTemplateElement;
  /** The fragment's own inert document: create new nodes here, never in the live `document`. */
  document: Document;
  content: DocumentFragment;
}

/** `html` parsed inertly, or null when there is no DOM (outside a browser). */
export function parseInert(html: string): InertFragment | null {
  if (typeof document === "undefined") return null;
  const template = document.createElement("template");
  template.innerHTML = html;
  return { template, document: template.content.ownerDocument, content: template.content };
}

/** Elements with no closing tag. */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** A letter or digit of a tag name. */
const isNameCode = (code: number): boolean =>
  (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57);

/**
 * ponytail: DOM_DEPTH_CEILING, 400 open tags: the deepest nesting that is parsed into a server-side DOM. Real
 * articles nest a few dozen deep; jsdom takes time quadratic in the depth (7 seconds at 6,000 `<s>` in a row) and
 * overflows its stack not far past that, so a page that nests deeper is left as it is by the passes that only
 * tidy it (`slimArticleHtml`, `markTemplateChips`).
 */
export const DOM_DEPTH_CEILING = 400;

/**
 * ponytail: DOM_SIZE_CEILING, 500,000 characters: the most HTML that is parsed into a server-side DOM to be
 * tidied. jsdom builds a DOM at about a microsecond a character for ordinary HTML and several microseconds an
 * element for HTML of nothing but one-character elements (500,000 characters of `<br>` take a second), on the
 * thread that serves requests, so a page of 2 MB of HTML would hold it for seconds for the sake of dropping a few
 * classes. Past this a page is left as it is; a lower ceiling when the slowest page tidied matters more than
 * the largest.
 */
export const DOM_SIZE_CEILING = 500_000;

/** The lower-case name of the tag whose name starts at `from` (letters and digits), or "" when none does. */
function tagNameAt(html: string, from: number): string {
  let end = from;
  while (isNameCode(html.charCodeAt(end))) end++;
  return html.slice(from, end).toLowerCase();
}

/**
 * Whether `html` holds more than DOM_DEPTH_CEILING tags open at once. An opening tag that is not a void element is
 * open until a closing tag of its name closes it, and everything opened after it with it (what the parser does:
 * a closing tag with no open element of its name is ignored, so `<s></i>` repeated nests as deep as it is long). An over-count
 * (the parser also closes `<p>` and `<li>` by itself), so a page can only be passed over, never parsed too deep.
 * One scan: a count of the open elements of each name says at once whether a closing tag closes anything.
 */
export function nestsTooDeep(html: string): boolean {
  const open: string[] = [];
  const openOfName = new Map<string, number>();
  for (let at = html.indexOf("<"); at !== -1; at = html.indexOf("<", at + 1)) {
    const code = html.charCodeAt(at + 1);
    if (code === 47) {
      const name = tagNameAt(html, at + 2);
      if (!openOfName.get(name)) continue;
      for (let top = open.pop(); top !== undefined; top = open.pop()) {
        openOfName.set(top, openOfName.get(top)! - 1);
        if (top === name) break;
      }
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      const name = tagNameAt(html, at + 1);
      if (VOID_ELEMENTS.has(name)) continue;
      open.push(name);
      openOfName.set(name, (openOfName.get(name) ?? 0) + 1);
      if (open.length > DOM_DEPTH_CEILING) return true;
    }
  }
  return false;
}

/** Whether a pass that only tidies HTML in a server-side DOM leaves `html` as it is: it is too long or nests too deep. */
export const leavesAlone = (html: string): boolean =>
  html.length > DOM_SIZE_CEILING || nestsTooDeep(html);
