/**
 * src/lib/wiki-os/wikitext/parser.ts — Universal Tolerant MediaWiki Parser.
 *
 * Invariant 5: Malformed user input never crashes the parser.
 * Invariant 6: Parse failure is never silent data loss.
 * Invariant 8: Grammar and semantics stay strictly separate.
 */

import { scanTemplates } from "./template-parser";
import { parseWikitable } from "./table-parser";
import { parseWikiList } from "./list-parser";
import { parseInlineLinksAndFormatting } from "./link-parser";
import type {
  WikiDocument,
  WikiBlockNode,
  ParseResult,
  Diagnostic,
  WikiHeadingBlock,
  WikiInfoboxBlock,
  WikiTemplateNode,
  WikiParserFunctionBlock,
  WikiRawNode,
  DividerBlock,
} from "./types";

export function parse(
  input: string,
  options?: { title?: string; slug?: string }
): ParseResult {
  const title = options?.title || "";
  const slug = options?.slug || "";
  const diagnostics: Diagnostic[] = [];
  const nodes: WikiBlockNode[] = [];

  if (!input || input.trim() === "") {
    return {
      ast: { title, slug, version: 1, nodes: [], diagnostics: [] },
      diagnostics: [],
    };
  }

  // 1. Scan for block-level templates and parser functions
  const { templates, diagnostics: tmplDiags } = scanTemplates(input);
  diagnostics.push(...tmplDiags);

  // Split document into inter-template text intervals and template blocks
  let cursor = 0;

  for (const tmpl of templates) {
    // Process text before this template
    if (tmpl.source.start > cursor) {
      const textChunk = input.slice(cursor, tmpl.source.start);
      parseTextBlocks(textChunk, nodes, diagnostics, cursor);
    }

    // Insert template or parser function block
    if (tmpl.isParserFunction) {
      const pfnNode: WikiParserFunctionBlock = {
        type: "parser-function",
        functionName: tmpl.functionName || tmpl.name,
        expression: tmpl.expression || "",
        branches: tmpl.branches || [],
        raw: tmpl.raw,
        rawWikitext: tmpl.raw,
        source: tmpl.source,
        parseState: tmpl.parseState,
        children: [{ text: "" }],
      };
      nodes.push(pfnNode);
    } else if (tmpl.classification === "infobox") {
      const infoboxNode: WikiInfoboxBlock = {
        type: "infobox",
        templateName: tmpl.name,
        title: tmpl.params["name"] || tmpl.params["title"] || tmpl.name,
        params: tmpl.params,
        paramList: tmpl.paramList,
        positional: tmpl.positional,
        classification: "infobox",
        raw: tmpl.raw,
        rawWikitext: tmpl.raw,
        source: tmpl.source,
        parseState: tmpl.parseState,
        children: [{ text: "" }],
      };
      nodes.push(infoboxNode);
    } else {
      const tmplNode: WikiTemplateNode = {
        type: "template",
        templateName: tmpl.name,
        name: tmpl.name,
        params: tmpl.params,
        paramList: tmpl.paramList,
        positional: tmpl.positional,
        classification: tmpl.classification,
        raw: tmpl.raw,
        rawWikitext: tmpl.raw,
        source: tmpl.source,
        parseState: tmpl.parseState,
        children: [{ text: "" }],
      };
      nodes.push(tmplNode);
    }

    cursor = tmpl.source.end;
  }

  // Process remaining text after last template
  if (cursor < input.length) {
    const textChunk = input.slice(cursor);
    parseTextBlocks(textChunk, nodes, diagnostics, cursor);
  }

  return {
    ast: {
      title,
      slug,
      version: 1,
      nodes,
      diagnostics,
    },
    diagnostics,
  };
}

function parseTextBlocks(
  text: string,
  nodes: WikiBlockNode[],
  diagnostics: Diagnostic[],
  baseOffset: number
): void {
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Empty lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // 1. Divider: ----
    if (/^----+$/.test(trimmed)) {
      const divider: DividerBlock = {
        type: "divider",
        children: [{ text: "" }],
      };
      nodes.push(divider);
      i++;
      continue;
    }

    // 2. Headings: = ... = to ====== ... ======
    const headingMatch = /^(={1,6})\s*(.+?)\s*\1$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(6, Math.max(1, headingMatch[1]!.length)) as 1 | 2 | 3 | 4 | 5 | 6;
      const content = headingMatch[2]!;
      const inlines = parseInlineLinksAndFormatting(content);
      const headingNode: WikiHeadingBlock = {
        type: "heading",
        level,
        children: inlines,
      };
      nodes.push(headingNode);
      i++;
      continue;
    }

    // 3. Wikitables: {| ... |}
    if (trimmed.startsWith("{|")) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length) {
        const curLine = lines[i]!;
        tableLines.push(curLine);
        if (curLine.trim() === "|}") {
          i++;
          break;
        }
        i++;
      }
      const rawTable = tableLines.join("\n");
      try {
        const tableNode = parseWikitable(rawTable);
        nodes.push(tableNode);
      } catch (_e) {
        nodes.push({
          type: "raw",
          raw: rawTable,
          rawWikitext: rawTable,
          reason: "malformed",
          children: [{ text: "" }],
        });
      }
      continue;
    }

    // 4. Lists: * or # or : or ;
    if (/^[\*#\:\;]/.test(trimmed)) {
      const listLines: string[] = [line];
      i++;
      while (i < lines.length && /^[\*#\:\;]/.test(lines[i]!.trim())) {
        listLines.push(lines[i]!);
        i++;
      }
      const listNode = parseWikiList(listLines);
      nodes.push(listNode);
      continue;
    }

    // 5. Code block / pre: <pre>...</pre>
    if (trimmed.startsWith("<pre")) {
      const preLines: string[] = [line];
      i++;
      while (i < lines.length) {
        const curLine = lines[i]!;
        preLines.push(curLine);
        if (curLine.includes("</pre>")) {
          i++;
          break;
        }
        i++;
      }
      const rawPre = preLines.join("\n");
      const codeMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(rawPre);
      const codeContent = codeMatch ? codeMatch[1]! : rawPre;
      nodes.push({
        type: "code-block",
        code: codeContent,
        children: [{ text: codeContent }],
      });
      continue;
    }

    // 6. Regular Paragraph: gather consecutive non-empty lines
    const pLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^={1,6}\s/.test(lines[i]!.trim()) &&
      !lines[i]!.trim().startsWith("{|") &&
      !/^[\*#\:\;]/.test(lines[i]!.trim()) &&
      !/^----+$/.test(lines[i]!.trim()) &&
      !lines[i]!.trim().startsWith("<pre")
    ) {
      pLines.push(lines[i]!);
      i++;
    }

    const pText = pLines.join("\n");
    const inlines = parseInlineLinksAndFormatting(pText);
    nodes.push({
      type: "paragraph",
      children: inlines,
    });
  }
}
