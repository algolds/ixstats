/**
 * link-normalizer.ts — a link with no text is not a link.
 *
 * Pressing Enter at the edge of a link, or deleting all of its text, leaves an empty inline `link`
 * element (Slate splits every inline ancestor, and removes text but not the element around it).
 * Such a node shows nothing and, written out, would be a phantom `[[Target]]` the author never
 * typed. The editor removes it as soon as it appears.
 */

import { Node, Transforms, type Editor, type NodeEntry } from "slate";

const LINK_TYPES = new Set(["link", "a"]);

/** Removes the node at `entry` when it is a link with no text; true when it did (the entry is then gone). */
export function removeEmptyLink(editor: Editor, [node, path]: NodeEntry): boolean {
  const type = (node as { type?: string }).type;
  if (type === undefined || !LINK_TYPES.has(type) || Node.string(node) !== "") return false;
  Transforms.removeNodes(editor, { at: path });
  return true;
}
