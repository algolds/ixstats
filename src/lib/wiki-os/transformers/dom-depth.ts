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

/** The depth each node was put at, as the parser built the tree (its subtree, if it is moved later, keeps its depths). */
const depths = new WeakMap<object, number>();

/** The parser builds a fragment's nodes under an `html` element it makes up (and moves them to the fragment at the end): one level that is not the page's. */
const PARSER_ROOT_LEVEL = 1;

/** Records that `child` was put under `parent`, and stops the parse when that is deeper than the ceiling. */
function place(parent: object, child: object): void {
  const depth = (depths.get(parent) ?? 0) + 1;
  depths.set(child, depth);
  if (depth - PARSER_ROOT_LEVEL > DOM_DEPTH_CEILING) throw new TooDeep();
}

/** parse5's default tree, with the depth of every node noted as it is put in place. */
function trackingAdapter(
  adapter: TreeAdapter<DefaultTreeAdapterMap>
): TreeAdapter<DefaultTreeAdapterMap> {
  return {
    ...adapter,
    appendChild(parent, node) {
      adapter.appendChild(parent, node);
      place(parent, node);
    },
    insertBefore(parent, node, reference) {
      adapter.insertBefore(parent, node, reference);
      place(parent, node);
    },
    setTemplateContent(template, content) {
      adapter.setTemplateContent(template, content);
      place(template, content);
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
  const pending: Array<[node: Node, depth: number]> = [[root, 0]];
  for (let next = pending.pop(); next; next = pending.pop()) {
    const [node, depth] = next;
    if (depth > DOM_DEPTH_CEILING) return true;
    for (const child of childrenOf(node)) pending.push([child, depth + 1]);
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
