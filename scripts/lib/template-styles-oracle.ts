/**
 * An independent reading of what `scopeTemplateStyles` emits (plan 415 review): the oracle for its tests and its deep
 * fuzz run (`scripts/audit/fuzz-template-styles.ts`).
 *
 * The oracle is lightningcss, a spec-following CSS parser like a browser's, run over the scoper's OUTPUT with
 * error recovery: it hands back the selectors it parsed (exact components, not text), every rule and every `url()`
 * it found. The scoper keeps its promises when none of these is a violation:
 *
 *  - every style rule's selector starts with the article root class in its first compound and reaches nothing
 *    but descendants or children of it (never a sibling of the root, never an ancestor);
 *  - no at-rule other than `@media` is left;
 *  - every `url()` resolves, the way a browser resolves it, to the page itself or to the wiki's own origin over
 *    https, and never to another host (`//host`, `\\host` and `https:/host` included);
 *  - no declaration holds `javascript:`, `expression(`, an image function that loads a URL without `url(`, or `attr(`;
 *  - the output has no `<`, which could end the `<style>` element.
 *
 * `template-styles-oracle-tokens.ts` is the second judge, built on a different tokenizer; both must report nothing.
 */
import { transform, type Selector } from "lightningcss";
import { parse as parseCss } from "postcss";
import { ARTICLE_STYLE_ROOT_CLASS } from "../../src/lib/utils/scope-template-styles";

/** The wiki's origin the scoper is told to allow. */
export const OWN_ORIGIN = "https://ixwiki.com";

const RELATIVE_BASE = "https://relative.invalid/";
const RELATIVE_ORIGIN = new URL(RELATIVE_BASE).origin;

/** Why `selector` can match outside the article's root, or null when it cannot. */
function selectorViolation(selector: Selector): string | null {
  let end = 0;
  let hasRoot = false;
  for (; end < selector.length && selector[end]?.type !== "combinator"; end++) {
    const component = selector[end];
    if (component?.type === "class" && component.name === ARTICLE_STYLE_ROOT_CLASS) hasRoot = true;
  }
  if (!hasRoot) return `first compound has no root class: ${JSON.stringify(selector.slice(0, 3))}`;
  const combinator = selector[end];
  if (combinator?.type === "combinator" && combinator.value !== "descendant" && combinator.value !== "child") {
    return `first combinator after the root is ${combinator.value}`;
  }
  return null;
}

/**
 * Why a browser may fetch `target` from a host the wiki does not own, or null when it may not: judged by where the
 * URL parser (WHATWG, as in a browser) says it points. Only the page's own origin (what a relative URL means) and
 * the wiki's, over https, are fine; `//host`, `\\host`, `https:/host` and the rest come out on another origin.
 */
function urlViolation(target: string): string | null {
  try {
    const resolved = new URL(target, RELATIVE_BASE);
    const fine = resolved.protocol === "https:" && (resolved.origin === RELATIVE_ORIGIN || resolved.origin === OWN_ORIGIN);
    return fine ? null : `url ${JSON.stringify(target)} -> ${resolved.href}`;
  } catch {
    return null; // not a URL a browser can fetch
  }
}

const SCRIPT_VALUE = /javascript:|expression\(|vbscript:/;
const URL_FUNCTION = /(?:^|[^\w-])(?:-webkit-)?(?:image-set|paint|element|cross-fade)\(/;

/** Everything about `css` (the scoper's output) that breaks a promise of the scoper; empty when it keeps them all. */
export function violations(css: string): string[] {
  const found: string[] = [];
  if (css.includes("<")) found.push("output holds <"); // it could end the <style> element
  let normalized: string;
  try {
    normalized = transform({
      filename: "o.css",
      code: Buffer.from(css),
      errorRecovery: true,
      visitor: {
        Rule(rule) {
          if (rule.type === "style") {
            for (const selector of rule.value.selectors) {
              const why = selectorViolation(selector);
              if (why) found.push(`SEL ${why}`);
            }
          } else if (rule.type !== "media") {
            found.push(`at-rule ${rule.type}`);
          }
        },
        Url(url) {
          const why = urlViolation(url.url);
          if (why) found.push(`URL ${why}`);
        },
      },
    }).code.toString();
  } catch (error) {
    return [`oracle could not parse the output: ${String(error)}`];
  }
  for (const [property, value] of declarationsOf(normalized)) {
    const lowered = value.toLowerCase();
    if (SCRIPT_VALUE.test(lowered)) found.push(`decl ${property}:${value}`);
    if (URL_FUNCTION.test(lowered)) found.push(`fn ${lowered}`);
    if (/attr\(/.test(lowered)) found.push(`attr() in ${property}:${value}`);
  }
  return found;
}

/**
 * The [property, value] pairs of lightningcss's printout of `css`. postcss reads it unless the printout holds a
 * declaration only a tolerant parser accepts (`https: //x`, from junk the scoper kept as a custom property); then
 * every line that ends in `;` is read as one declaration, so nothing is skipped.
 */
function declarationsOf(css: string): Array<[string, string]> {
  try {
    const pairs: Array<[string, string]> = [];
    parseCss(css).walkDecls((declaration) => {
      pairs.push([declaration.prop, declaration.value]);
    });
    return pairs;
  } catch {
    return css
      .split("\n")
      .filter((line) => line.endsWith(";"))
      .map((line): [string, string] => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim(), line.slice(colon + 1, -1).trim()];
      });
  }
}
