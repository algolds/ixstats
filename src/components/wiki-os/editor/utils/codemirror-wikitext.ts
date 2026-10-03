import { Decoration, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { scanTemplates } from "~/lib/wiki-os/wikitext/template-parser";

const headingDeco = Decoration.mark({ class: "cm-wikitext-heading" });
const listDeco = Decoration.mark({ class: "cm-wikitext-list" });
const boldDeco = Decoration.mark({ class: "cm-wikitext-bold" });
const italicDeco = Decoration.mark({ class: "cm-wikitext-italic" });
const linkDeco = Decoration.mark({ class: "cm-wikitext-link" });
const extlinkDeco = Decoration.mark({ class: "cm-wikitext-extlink" });
const templateDeco = Decoration.mark({ class: "cm-wikitext-template" });
const refDeco = Decoration.mark({ class: "cm-wikitext-ref" });

interface DecoRange {
  from: number;
  to: number;
  deco: Decoration;
}

/** Inline wikitext patterns; `skip` rejects a hit that is really part of a longer marker (''' vs ''). */
const INLINE_RULES: ReadonlyArray<{
  re: RegExp;
  deco: Decoration;
  skip?: (text: string, start: number, end: number) => boolean;
}> = [
  { re: /'''([^'\n]+?)'''/g, deco: boldDeco },
  {
    re: /''([^'\n]+?)''/g,
    deco: italicDeco,
    skip: (text, start, end) => text[start - 1] === "'" || text[end] === "'",
  },
  { re: /\[\[([^\]\n]+?)\]\]/g, deco: linkDeco },
  {
    re: /\[([^[\]\n]+?)\]/g,
    deco: extlinkDeco,
    skip: (text, start, end) => text[start - 1] === "[" || text[end] === "]",
  },
  { re: /<ref[^>]*>|<\/ref>/gi, deco: refDeco },
];

/** Decorations for one line: heading or list marker, then inline marks, links and refs. */
function lineRanges(lineText: string, lineFrom: number): DecoRange[] {
  const ranges: DecoRange[] = [];

  if (/^(={1,6})\s*(.+?)\s*\1\s*$/.test(lineText)) {
    ranges.push({ from: lineFrom, to: lineFrom + lineText.length, deco: headingDeco });
  } else {
    const listMarker = /^([*#:;]+)/.exec(lineText)?.[1];
    if (listMarker)
      ranges.push({ from: lineFrom, to: lineFrom + listMarker.length, deco: listDeco });
  }

  for (const { re, deco, skip } of INLINE_RULES) {
    for (const m of lineText.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!skip?.(lineText, start, end)) {
        ranges.push({ from: lineFrom + start, to: lineFrom + end, deco });
      }
    }
  }
  return ranges;
}

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
      const { doc } = view.state;

      // Multiline balanced templates (handles line wraps & multi-line blocks)
      const matches: DecoRange[] = scanTemplates(doc.toString()).templates.map((tmpl) => ({
        from: tmpl.source.start,
        to: tmpl.source.end,
        deco: templateDeco,
      }));

      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos < to;) {
          const line = doc.lineAt(pos);
          matches.push(...lineRanges(line.text, line.from));
          pos = line.to + 1;
        }
      }

      // Sort, then drop overlaps (the earliest, longest range wins)
      matches.sort((a, b) => a.from - b.from || b.to - a.to);
      let lastTo = -1;
      for (const { from, to, deco } of matches) {
        if (from >= to || from < lastTo) continue;
        lastTo = to;
        if (from >= 0 && to <= doc.length) builder.add(from, to, deco);
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
