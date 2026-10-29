// The toolbar's DOM fallback: the formats the browser's live selection sits inside in the visual editor.

interface DomFormatRule {
  formats: readonly string[];
  tags: readonly string[];
  /** Substring of the element's class attribute. */
  className?: string;
  style?: (style: CSSStyleDeclaration) => boolean;
  /** Selector used to inspect a cloned selection fragment (defaults to the tags). */
  selector?: string | false;
}

const DOM_FORMAT_RULES: readonly DomFormatRule[] = [
  {
    formats: ["bold"],
    tags: ["strong", "b"],
    style: (s) => s.fontWeight === "bold" || parseInt(s.fontWeight, 10) >= 600,
  },
  { formats: ["italic"], tags: ["em", "i"], style: (s) => s.fontStyle === "italic" },
  { formats: ["underline"], tags: ["u"], style: (s) => !!s.textDecoration?.includes("underline") },
  {
    formats: ["strikethrough", "strike"],
    tags: ["s", "strike", "del"],
    style: (s) => !!s.textDecoration?.includes("line-through"),
  },
  { formats: ["superscript", "sup"], tags: ["sup"] },
  { formats: ["subscript", "sub"], tags: ["sub"] },
  { formats: ["code"], tags: ["code", "pre"], className: "font-mono" },
  { formats: ["blockquote"], tags: ["blockquote"] },
  { formats: ["ul"], tags: ["ul"] },
  { formats: ["ol"], tags: ["ol"] },
  { formats: ["table"], tags: ["table", "td", "th", "tr"], selector: "table" },
  { formats: ["link"], tags: ["a"] },
  ...["h1", "h2", "h3", "h4"].map((h) => ({
    formats: [h],
    tags: [h],
    className: `wikios-ve-${h}`,
    selector: `.wikios-ve-${h}, ${h}`,
  })),
  { formats: ["p", "paragraph"], tags: ["p"], className: "wikios-ve-p", selector: false },
];

function elementMatchesRule(el: HTMLElement, rule: DomFormatRule): boolean {
  return (
    rule.tags.includes(el.tagName.toLowerCase()) ||
    !!(rule.className && (el.className || "").includes(rule.className)) ||
    !!rule.style?.(el.style)
  );
}

/**
 * Inspect the browser's live DOM selection inside the visual editor to instantly
 * detect active formatting tags (<strong>, <em>, <u>, <s>, <code>, <h2>, etc.)
 * with zero latency and complete framework independence.
 */
export function getDomActiveFormats(): Set<string> {
  const fmt = new Set<string>();
  if (typeof window === "undefined") return fmt;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return fmt;

  const editorEl =
    document.querySelector(".wikios-ve-content") ||
    document.querySelector("[contenteditable='true']");
  const anchorNode = sel.anchorNode;
  if (!editorEl || !anchorNode || !editorEl.contains(anchorNode)) return fmt;

  let curr: HTMLElement | null =
    anchorNode.nodeType === 1 ? (anchorNode as HTMLElement) : anchorNode.parentElement;

  while (curr && curr !== editorEl && editorEl.contains(curr)) {
    for (const rule of DOM_FORMAT_RULES) {
      if (elementMatchesRule(curr, rule)) rule.formats.forEach((f) => fmt.add(f));
    }
    curr = curr.parentElement;
  }

  // If text is selected (expanded range), inspect the contents of the range
  if (!sel.isCollapsed) {
    try {
      const fragment = sel.getRangeAt(0).cloneContents();
      for (const rule of DOM_FORMAT_RULES) {
        const selector = rule.selector ?? rule.tags.join(", ");
        if (selector && fragment.querySelector(selector)) rule.formats.forEach((f) => fmt.add(f));
      }
    } catch {
      /* best effort */
    }
  }

  return fmt;
}
