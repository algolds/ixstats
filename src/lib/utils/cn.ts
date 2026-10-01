import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge that knows the Facet 3 token utilities (src/styles/facet/tokens.css). Without this it
 * reads every unknown `text-*` as a colour, so `cn("text-body text-label")` would drop one of them.
 */
const twMerge = extendTailwindMerge<"material">({
  extend: {
    theme: {
      text: [
        "display",
        "large-title",
        "title-1",
        "title-2",
        "title-3",
        "headline",
        "body",
        "callout",
        "subhead",
        "footnote",
        "caption",
        "eyebrow",
      ],
      radius: ["sheet", "card", "row", "control-lg", "control", "control-sm"],
      shadow: ["card", "floating", "sheet"],
    },
    classGroups: {
      z: [
        {
          z: [
            "base",
            "raised",
            "sticky",
            "chrome",
            "nav",
            "backdrop",
            "sheet",
            "popover",
            "tooltip",
            "toast",
            "command",
          ],
        },
      ],
      material: [{ material: ["thin", "regular", "thick"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Title-case a snake/space/lower string for display, e.g. "constitutional monarchy" → "Constitutional Monarchy".
 * Idempotent: already-cased values pass through unchanged.
 */
export function toTitleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
