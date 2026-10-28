/**
 * Inline spoilers in ThinkPages posts, written `||text||` as on Discord (the Discord mirror sends the bars through
 * unchanged). The formatter wraps them in `<span data-spoiler>` before sanitizing, then `decorateSpoilers` adds the
 * button semantics after, so the sanitizer's allowlist never gains `role` or `tabindex` for member HTML.
 */

export const SPOILER_LABEL = "Spoiler, select to show";

/** One pair of bars on one line; the text holds no bar or tag, so a match never spans or enters a tag. */
const SPOILER_PATTERN = /\|\|([^|<>\n]+?)\|\|/g;

/** `||text||` in tag-free (already escaped) text, as spoiler spans. */
export function wrapSpoilers(text: string): string {
  return text.replace(SPOILER_PATTERN, "<span data-spoiler>$1</span>");
}

/** `||text||` hidden in a plain-text preview that has no reveal control. */
export function maskSpoilers(text: string): string {
  return text.replace(SPOILER_PATTERN, "(spoiler)");
}

/** The same, in the text between the tags of stored HTML only. */
export function wrapSpoilersInHtml(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") ? part : wrapSpoilers(part)))
    .join("");
}

/** Sanitized HTML with every bare spoiler span made a keyboard-operable button. */
export function decorateSpoilers(sanitizedHtml: string): string {
  return sanitizedHtml.replaceAll(
    '<span data-spoiler="">',
    `<span data-spoiler="" role="button" tabindex="0" aria-label="${SPOILER_LABEL}">`
  );
}

/** The decorated attributes as React props, for renderers that rebuild the sanitized HTML as elements. */
export const SPOILER_PROPS = {
  "data-spoiler": "",
  role: "button",
  tabIndex: 0,
  "aria-label": SPOILER_LABEL,
} as const;

/**
 * The delegated click and keydown handler for a post body: reveals the hidden spoiler the event hit (click, Enter or
 * Space) and keeps the event from the post card underneath. A revealed spoiler becomes plain text again.
 */
export function revealSpoilerFromEvent(event: Event): void {
  if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
  if (!(event.target instanceof Element)) return;
  const spoiler = event.target.closest("[data-spoiler]:not([data-revealed])");
  if (!spoiler) return;
  event.preventDefault();
  event.stopPropagation();
  spoiler.setAttribute("data-revealed", "");
  for (const attr of ["role", "tabindex", "aria-label"]) spoiler.removeAttribute(attr);
}
