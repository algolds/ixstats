/**
 * wiki-ast-guards.ts — Type guards for AST nodes.
 */

import type {
  WikiNode,
  WikiBlockNode,
  WikiInlineNode,
  WikiTextNode,
  WikiInfoboxBlock,
  TemplateBlock,
  WikiHeadingBlock,
  WikiParagraphBlock,
  MediaBlock,
} from "./wiki-ast";

export function isTextNode(node: WikiNode): node is WikiTextNode {
  return typeof (node as WikiTextNode).text === "string";
}

export function isBlockNode(node: WikiNode): node is WikiBlockNode {
  return !isTextNode(node) && "type" in node;
}

export function isInlineNode(node: WikiNode): node is WikiInlineNode {
  return !isBlockNode(node);
}

export function isHeadingBlock(node: WikiBlockNode): node is WikiHeadingBlock {
  return node.type === "heading";
}

export function isParagraphBlock(node: WikiBlockNode): node is WikiParagraphBlock {
  return node.type === "paragraph";
}

export function isInfoboxBlock(node: WikiBlockNode): node is WikiInfoboxBlock {
  return node.type === "infobox";
}

export function isTemplateBlock(node: WikiBlockNode): node is TemplateBlock {
  return node.type === "template";
}

export function isMediaBlock(node: WikiBlockNode): node is MediaBlock {
  return node.type === "media";
}
