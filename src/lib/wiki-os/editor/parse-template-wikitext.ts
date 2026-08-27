/**
 * parse-template-wikitext.ts — Parse a `{{TemplateName|key=val|...}}` wikitext
 * string into a structured { name, params } object.
 */

export interface ParsedTemplate {
  name: string;
  params: Record<string, string>;
}

/**
 * Parse wikitext template invocation into name + key-value params.
 * Handles both `{{Name|key=val}}` and `[[Type:value|label]]` bracket formats.
 *
 * @param wikitext - Raw wikitext string (e.g. `{{Infobox country|capital=Vilena}}`)
 * @param defaultName - Fallback name if the template name is empty
 * @param brackets - Which bracket style to strip: "curly" for `{{ }}`, "square" for `[[ ]]`
 */
export function parseTemplateWikitext(
  wikitext: string,
  defaultName = "Template",
  brackets: "curly" | "square" = "curly"
): ParsedTemplate {
  const open = brackets === "curly" ? /^\{\{/ : /^\[\[/;
  const close = brackets === "curly" ? /\}\}$/ : /\]\]$/;

  const clean = wikitext.trim().replace(open, "").replace(close, "");
  const parts = clean.split("|");
  const name = parts[0]?.trim() || defaultName;
  const params: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    const eq = p.indexOf("=");
    if (eq !== -1) {
      params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    }
  }

  return { name, params };
}
