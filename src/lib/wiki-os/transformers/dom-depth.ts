// src/lib/wiki-os/transformers/dom-depth.ts
// How deep the HTML parser nests a page, asked of the parser itself. Server modules only: it loads parse5, the
// parser jsdom (and so the sanitizer, the slimmer and the chip marker) parses with, and a browser must never bundle it.
//
// jsdom's DOM is quadratic in depth (6,000 nested `<s>` take 5 s, and it overflows its stack soon after), so a page
// that nests deeper than DOM_DEPTH_CEILING is not handed to it. Counting tags cannot tell how deep that is: the
// parser ignores a closing tag that a special element stops (`<span><div></span>`, `<div><table><tr><td></div>`),
// ignores a closing tag of another name (`<s><div:x></s:y>`), and its adoption agency keeps formatting elements
// open (`<i><b></i>`), so a page of a few hundred tags nests thousands deep; and a `<` inside an attribute or a
// comment is no tag. So the page is parsed, and the parse is stopped as soon as it nests too deep: the cost is
// bounded by the ceiling (parse5 itself is quadratic in the depth it reaches, 8 s for 400 KB of `<div>`).

import type { DefaultTreeAdapterMap, TreeAdapter } from "parse5";
import { DOM_DEPTH_CEILING, DOM_SIZE_CEILING } from "./inert-dom";

type Parse5 = typeof import("parse5");
type Node = DefaultTreeAdapterMap["node"];

let parse5: Parse5 | null = null;

/** Thrown by the tree adapter the moment a node is put deeper than the ceiling: stops the parse. */
class TooDeep {}

/** The parser builds a fragment's nodes under an `html` element it makes up (and moves them to the fragment at the end): one level that is not the page's. */
const PARSER_ROOT_LEVEL = 1;

/** The parent of `node` (a document and a fragment have none). */
const parentOf = (node: Node): Node | null => ("parentNode" in node ? node.parentNode : null);

/**
 * parse5's default tree, with the parse stopped (by throwing TooDeep) the moment a node is put deeper than the ceiling.
 * A node's depth is the length of its chain of parents (at most the ceiling, since the parse stops there): nothing is
 * kept per node, which the parser would have to be slowed by (a WeakMap that outlives a parse makes every garbage
 * collection of a large page slow, and a Map of it adds to the garbage of one). The content of a template is a tree of
 * its own, which starts at the depth of the template.
 */
function trackingAdapter(
  adapter: TreeAdapter<DefaultTreeAdapterMap>
): TreeAdapter<DefaultTreeAdapterMap> {
  const contentBase = new Map<object, number>();
  const depthOf = (node: Node): number => {
    let depth = 0;
    let top: Node = node;
    for (let at = parentOf(top); at; at = parentOf(at)) {
      depth++;
      top = at;
    }
    return depth + (contentBase.get(top) ?? 0);
  };
  const check = (node: Node): void => {
    if (depthOf(node) - PARSER_ROOT_LEVEL > DOM_DEPTH_CEILING) throw new TooDeep();
  };
  return {
    ...adapter,
    appendChild(parent, node) {
      adapter.appendChild(parent, node);
      check(node);
    },
    insertBefore(parent, node, reference) {
      adapter.insertBefore(parent, node, reference);
      check(node);
    },
    setTemplateContent(template, content) {
      adapter.setTemplateContent(template, content);
      contentBase.set(content, depthOf(template) + 1);
    },
  };
}

/** The children of `node`: a template's are in its content. */
function childrenOf(node: Node): readonly Node[] {
  if ("content" in node) return node.content.childNodes;
  return "childNodes" in node ? node.childNodes : [];
}

/** Whether the tree under `root` is deeper than the ceiling, by an iterative walk (the parser can move a subtree, whose nodes keep the depths they were put at). */
function deeperThanCeiling(root: Node): boolean {
  const nodes: Node[] = [root];
  const levels: number[] = [0];
  for (
    let node = nodes.pop(), depth = levels.pop();
    node !== undefined;
    node = nodes.pop(), depth = levels.pop()
  ) {
    if (depth! > DOM_DEPTH_CEILING) return true;
    for (const child of childrenOf(node)) {
      nodes.push(child);
      levels.push(depth! + 1);
    }
  }
  return false;
}

/**
 * Whether the HTML parser nests `html` deeper than DOM_DEPTH_CEILING (400; real pages nest a few dozen). It reads
 * the page as jsdom does (a template's fragment, scripting off: the contents of a `<noscript>` are elements).
 * Linear for a page that does not, since the parse stops at the ceiling.
 */
export function nestsTooDeep(html: string): boolean {
  parse5 ??= require("parse5") as Parse5;
  try {
    const fragment = parse5.parseFragment(html, {
      scriptingEnabled: false,
      treeAdapter: trackingAdapter(parse5.defaultTreeAdapter),
    });
    return deeperThanCeiling(fragment);
  } catch (error) {
    if (error instanceof TooDeep) return true;
    throw error;
  }
}

/** Whether a pass that only tidies HTML in a server-side DOM leaves `html` as it is: it is too long, or the parser nests it too deep. */
export const leavesAlone = (html: string): boolean =>
  html.length > DOM_SIZE_CEILING || nestsTooDeep(html);
