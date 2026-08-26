// src/components/wiki-os/editor/utils/codemirror-wikitext.ts
// CodeMirror 6 custom decorations, syntax highlighter, and command utilities for Wikitext.

import { Decoration, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { scanTemplates } from "~/lib/wiki-os/wikitext/template-parser";

export const headingDeco = Decoration.mark({ class: "cm-wikitext-heading" });
export const listDeco = Decoration.mark({ class: "cm-wikitext-list" });
export const boldDeco = Decoration.mark({ class: "cm-wikitext-bold" });
export const italicDeco = Decoration.mark({ class: "cm-wikitext-italic" });
export const linkDeco = Decoration.mark({ class: "cm-wikitext-link" });
export const extlinkDeco = Decoration.mark({ class: "cm-wikitext-extlink" });
export const templateDeco = Decoration.mark({ class: "cm-wikitext-template" });
export const refDeco = Decoration.mark({ class: "cm-wikitext-ref" });

export const wikitextHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const docText = view.state.doc.toString();
      const matches: { from: number; to: number; deco: Decoration }[] = [];

      // 1. Multiline Balanced Templates Scan (Handles line wraps & multi-line blocks)
      const { templates } = scanTemplates(docText);
      for (const tmpl of templates) {
        matches.push({
          from: tmpl.source.start,
          to: tmpl.source.end,
          deco: templateDeco,
        });
      }

      // 2. Line-by-line syntax for headings, lists, inline marks, links
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos < to) {
          const line = view.state.doc.lineAt(pos);
          const lineText = line.text;
          const lineFrom = line.from;
          const lineTo = line.to;

          // Headings
          const headingMatch = /^(={1,6})\s*(.+?)\s*\1\s*$/.exec(lineText);
          if (headingMatch) {
            matches.push({ from: lineFrom, to: lineTo, deco: headingDeco });
          } else {
            // Lists
            const listMatch = /^([\*#\:\;]+)/.exec(lineText);
            if (listMatch) {
              matches.push({
                from: lineFrom,
                to: lineFrom + listMatch[1]!.length,
                deco: listDeco,
              });
            }
          }

          // Bold: '''text'''
          const boldRegex = /'''([^'\n]+?)'''/g;
          let m;
          while ((m = boldRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: boldDeco,
            });
          }

          // Italic: ''text''
          const italicRegex = /''([^'\n]+?)''/g;
          while ((m = italicRegex.exec(lineText)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            const isBoldStart = start > 0 && lineText[start - 1] === "'";
            const isBoldEnd = end < lineText.length && lineText[end] === "'";
            if (!isBoldStart && !isBoldEnd) {
              matches.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: italicDeco,
              });
            }
          }

          // Wiki Links: [[Page]] or [[Page|Title]]
          const wikiLinkRegex = /\[\[([^\]\n]+?)\]\]/g;
          while ((m = wikiLinkRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: linkDeco,
            });
          }

          // External Links: [URL Title] or [URL]
          const extLinkRegex = /\[([^\[\]\n]+?)\]/g;
          while ((m = extLinkRegex.exec(lineText)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            const isWikiStart = start > 0 && lineText[start - 1] === "[";
            const isWikiEnd = end < lineText.length && lineText[end] === "]";
            if (!isWikiStart && !isWikiEnd) {
              matches.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: extlinkDeco,
              });
            }
          }

          // References: <ref>...</ref>
          const refRegex = /<ref[^>]*>|<\/ref>/gi;
          while ((m = refRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: refDeco,
            });
          }

          pos = line.to + 1;
        }
      }

      // Sort matches
      matches.sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return b.to - a.to;
      });

      // Filter visible and resolve overlaps
      const validMatches: typeof matches = [];
      let lastTo = -1;

      for (const match of matches) {
        if (match.from >= match.to) continue;
        if (match.from >= lastTo) {
          validMatches.push(match);
          lastTo = match.to;
        }
      }

      // Add to builder
      for (const match of validMatches) {
        if (match.from < match.to && match.from >= 0 && match.to <= view.state.doc.length) {
          builder.add(match.from, match.to, match.deco);
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export const wrapSelectionCM = (view: EditorView, before: string, after: string) => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: to + before.length },
    userEvent: "input",
  });
  return true;
};

export const insertAtCursorCM = (view: EditorView, text: string) => {
  const { from } = view.state.selection.main;
  view.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + text.length },
    userEvent: "input",
  });
  return true;
};

export const toggleLinePrefixCM = (view: EditorView, prefix: string) => {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  if (line.text.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: "" },
      userEvent: "input",
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      userEvent: "input",
    });
  }
  return true;
};
