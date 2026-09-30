import { splitBalancedPipes, parseParameterList } from "~/lib/wiki-os/wikitext/parameter-parser";

export interface ParsedTemplate {
  name: string;
  params: Record<string, string>;
  positional?: string[];
}

/**
 * Parse wikitext template invocation into name + key-value params.
 * Handles both `{{Name|key=val}}` and `[[Type:value|label]]` bracket formats,
 * respecting nested templates, wikilinks, wikitables, and HTML comments.
 *
 * @param wikitext - Raw wikitext string (e.g. `{{Infobox country|capital=[[Vilena|Vilena City]]}}`)
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
  if (!clean) {
    return { name: defaultName, params: {}, positional: [] };
  }

  const parts = splitBalancedPipes(clean);
  const name = parts[0]?.trim() || defaultName;
  const { params, positional } = parseParameterList(parts);

  const res: ParsedTemplate = { name, params };
  if (positional.length > 0) {
    res.positional = positional;
  }
  return res;
}


