/**
 * scripts/audit/wikios-regex-fuzz-targets.ts — what the WikiOS regex-DoS fuzz runs, and on what.
 *
 * Page text is user-controlled and up to 2,000,000 characters; anonymous readers trigger the
 * processing of it. Every function listed in TARGETS takes such text (wikitext, HTML or an XML dump)
 * and must be linear, or bounded, on hostile input. Two runners use this file:
 *   - scripts/audit/wikios-regex-fuzz.ts       2 MB inputs, a worker per function, a 200 ms budget
 *   - src/tests/lib/wiki-os/regex-dos.test.ts  ~200 KB inputs, in the Jest process, a 150 ms budget
 *
 * Importing a target loads its module lazily (so a worker only loads what it measures), and none of
 * them reaches the database or the network: the modules that do (render-service, native-search-service,
 * article-repository, cache-service, the bridge readers) are in SKIPPED with the reason.
 */

// ---------------------------------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------------------------------

/** What a target's call returns; the runner only times it. */
type Result = string | number | boolean | object | null | undefined | void;

export type TargetKind = "wikitext" | "html" | "xml";

export interface Target {
  /** `folder/file#export`, as listed in this file; `@…` names the way the function is driven. */
  name: string;
  /** What the function reads: wikitext, HTML (also fed the wikitext families) or an XML dump. */
  kind: TargetKind;
  /** Imports the module and returns the call that takes the hostile text. */
  load: () => Promise<(input: string) => Result | Promise<Result>>;
  /**
   * What the function is allowed that the rest are not, and why. `maxChars`: the most text it accepts (it
   * answers a longer one with a plain copy or a refusal of its own, so the run feeds it that much and no more).
   * `slowFactor`: a multiple of the budget, for a function that is linear but whose answer is a record per
   * few characters (a text of nothing but `|` has a million parameters, and building them is the work).
   */
  limits?: { maxChars?: number; slowFactor?: number; why: string };
}

const wikitext = (name: string, load: Target["load"], limits?: Target["limits"]): Target => ({
  name,
  kind: "wikitext",
  load,
  ...(limits ? { limits } : {}),
});
const html = (name: string, load: Target["load"], limits?: Target["limits"]): Target => ({
  name,
  kind: "html",
  load,
  ...(limits ? { limits } : {}),
});
const xml = (name: string, load: Target["load"]): Target => ({ name, kind: "xml", load });

/**
 * What a function that does more work per character than most is allowed (`why` says what). It is linear (a
 * text ten times as long takes ten times as long, which the probe checks), only with a larger constant: the
 * answer is a record per few characters, so a text of nothing but `{{a}}` or `|` has a million records in it
 * and building them is the work; or the function builds an index of the whole text before it reads any of it.
 */
const linear = (slowFactor: number, why: string): Target["limits"] => ({
  slowFactor,
  why: `linear; ${why}`,
});
const bound = (slowFactor: number, answer: string): Target["limits"] =>
  linear(slowFactor, `its answer is ${answer}, and building that is the work`);

/**
 * Every place `opener` starts (overlapping ones too: `[[[` has two), outside `<!-- -->`: the openers a caller
 * asks about, since the block and inline parsers copy a comment whole before they look at what is in it.
 */
function* openersOutsideComments(text: string, opener: string): Generator<number> {
  let comment = text.indexOf("<!--");
  for (let at = text.indexOf(opener); at !== -1; at = text.indexOf(opener, at + 1)) {
    while (comment !== -1 && comment < at) {
      const end = text.indexOf("-->", comment + 4);
      if (end === -1) return; // the rest of the text is comment
      if (at < end + 3) break; // `at` is inside it
      comment = text.indexOf("<!--", end + 3);
    }
    if (comment !== -1 && comment < at) continue;
    yield at;
  }
}

export const TARGETS: readonly Target[] = [
  // ---- wikitext/ -------------------------------------------------------------------------------
  wikitext("wikitext/block-lines#logicalLineEnd", async () => {
    const m = await import("~/lib/wiki-os/wikitext/block-lines");
    return (s) => m.logicalLineEnd(s, 0);
  }),
  wikitext(
    "wikitext/block-lines#splitLogicalLines",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/block-lines");
      return (s) => m.splitLogicalLines(s);
    },
    linear(
      2,
      "it indexes the braces of the whole text, and a text of nothing but `<` and `{{` asks the tag and template scans about every few characters"
    )
  ),
  wikitext("wikitext/block-lines#isTemplateOnlyLine", async () => {
    const m = await import("~/lib/wiki-os/wikitext/block-lines");
    return (s) => m.isTemplateOnlyLine(s);
  }),
  wikitext("wikitext/file-params#parseFileLinkInner", async () => {
    const m = await import("~/lib/wiki-os/wikitext/file-params");
    return (s) => m.parseFileLinkInner(s);
  }),
  wikitext("wikitext/file-params#buildFileLink", async () => {
    const m = await import("~/lib/wiki-os/wikitext/file-params");
    return (s) => m.buildFileLink(s, [s, "thumb"], s);
  }),
  wikitext("wikitext/link-parser#findMatchingClosingBrackets", async () => {
    const m = await import("~/lib/wiki-os/wikitext/link-parser");
    return (s) => m.findMatchingClosingBrackets(s, 0);
  }),
  wikitext("wikitext/link-parser#findMatchingClosingBrackets@every-opener", async () => {
    const m = await import("~/lib/wiki-os/wikitext/link-parser");
    const { matchBrackets } = await import("~/lib/wiki-os/wikitext/match-index");
    return (s) => {
      const index = matchBrackets(s);
      for (const at of openersOutsideComments(s, "[[")) m.findMatchingClosingBrackets(s, at, index);
    };
  }),
  wikitext("wikitext/link-parser#findMatchingClosingBraces", async () => {
    const m = await import("~/lib/wiki-os/wikitext/link-parser");
    return (s) => m.findMatchingClosingBraces(s, 0);
  }),
  wikitext("wikitext/link-parser#findMatchingClosingBraces@every-opener", async () => {
    const m = await import("~/lib/wiki-os/wikitext/link-parser");
    const { matchBraces } = await import("~/lib/wiki-os/wikitext/match-index");
    return (s) => {
      const index = matchBraces(s);
      for (const at of openersOutsideComments(s, "{{")) m.findMatchingClosingBraces(s, at, index);
    };
  }),
  wikitext(
    "wikitext/link-parser#parseMediaLink",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/link-parser");
      return (s) => m.parseMediaLink(`[[File:${s}]]`);
    },
    bound(2, "a parameter per `|`")
  ),
  wikitext(
    "wikitext/link-parser#parseInlineLinksAndFormatting",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/link-parser");
      return (s) => m.parseInlineLinksAndFormatting(s);
    },
    bound(4, "a node per few characters")
  ),
  wikitext(
    "wikitext/list-parser#parseWikiList",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/list-parser");
      return (s) => m.parseWikiList(s.split("\n"));
    },
    bound(4, "an item per line")
  ),
  wikitext("wikitext/match-index#matchBraces", async () => {
    const m = await import("~/lib/wiki-os/wikitext/match-index");
    return (s) => m.matchBraces(s);
  }),
  wikitext("wikitext/match-index#matchBrackets", async () => {
    const m = await import("~/lib/wiki-os/wikitext/match-index");
    return (s) => m.matchBrackets(s);
  }),
  wikitext("wikitext/new-section#appendNewSection", async () => {
    const m = await import("~/lib/wiki-os/wikitext/new-section");
    return (s) => m.appendNewSection(s);
  }),
  wikitext("wikitext/parameter-parser#splitBalancedPipes", async () => {
    const m = await import("~/lib/wiki-os/wikitext/parameter-parser");
    return (s) => m.splitBalancedPipes(s);
  }),
  wikitext("wikitext/parameter-parser#findBalancedEquals", async () => {
    const m = await import("~/lib/wiki-os/wikitext/parameter-parser");
    return (s) => m.findBalancedEquals(s);
  }),
  wikitext(
    "wikitext/parameter-parser#parseParameterList",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/parameter-parser");
      return (s) => m.parseParameterList(m.splitBalancedPipes(s));
    },
    bound(6, "a parameter per `|`")
  ),
  wikitext(
    "wikitext/parser#parse",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/parser");
      return (s) => m.parse(s);
    },
    bound(4, "a node per construct")
  ),
  wikitext("wikitext/protected-regions#matchOpenTag", async () => {
    const m = await import("~/lib/wiki-os/wikitext/protected-regions");
    return (s) => m.matchOpenTag(s, 0, new m.ProtectedScanner(s));
  }),
  wikitext("wikitext/protected-regions#skipProtectedAt@every-opener", async () => {
    const m = await import("~/lib/wiki-os/wikitext/protected-regions");
    return (s) => {
      const scanner = new m.ProtectedScanner(s); // one per text, as every caller makes it
      for (let at = s.indexOf("<"); at !== -1; at = s.indexOf("<", at + 1)) {
        m.skipProtectedAt(s, at, true, scanner);
      }
    };
  }),
  wikitext("wikitext/protected-regions#isCommentOnly", async () => {
    const m = await import("~/lib/wiki-os/wikitext/protected-regions");
    return (s) => m.isCommentOnly(s);
  }),
  wikitext("wikitext/quote-marks#joinMarkedSegments", async () => {
    const m = await import("~/lib/wiki-os/wikitext/quote-marks");
    return (s) =>
      m.joinMarkedSegments([
        { text: s, bold: true, italic: false, isText: true },
        { text: s, bold: false, italic: true, isText: false },
      ]);
  }),
  wikitext("wikitext/quote-marks#wrapQuotes", async () => {
    const m = await import("~/lib/wiki-os/wikitext/quote-marks");
    return (s) => m.wrapQuotes(s, true, true);
  }),
  wikitext("wikitext/resolver#classifyTemplate", async () => {
    const m = await import("~/lib/wiki-os/wikitext/resolver");
    return (s) => m.classifyTemplate(s);
  }),
  wikitext("wikitext/section-locator#findSectionLine", async () => {
    const m = await import("~/lib/wiki-os/wikitext/section-locator");
    return (s) => m.findSectionLine(s, "History");
  }),
  wikitext("wikitext/section-locator#findSectionLine@hostile-section", async () => {
    const m = await import("~/lib/wiki-os/wikitext/section-locator");
    return (s) => m.findSectionLine("== History ==\n", s);
  }),
  wikitext("wikitext/section-locator#sectionHeadings", async () => {
    const m = await import("~/lib/wiki-os/wikitext/section-locator");
    return (s) => m.sectionHeadings(s);
  }),
  wikitext("wikitext/section-locator#locateSection", async () => {
    const m = await import("~/lib/wiki-os/wikitext/section-locator");
    return (s) => m.locateSection(s, 1);
  }),
  wikitext("wikitext/section-locator#replaceSection", async () => {
    const m = await import("~/lib/wiki-os/wikitext/section-locator");
    return (s) => m.replaceSection(s, 1, "x");
  }),
  wikitext(
    "wikitext/serializer#astToWikitext@parse",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/serializer");
      const { parse } = await import("~/lib/wiki-os/wikitext/parser");
      return (s) => m.astToWikitext(parse(s).ast);
    },
    bound(4, "a node per construct, parsed and written back")
  ),
  wikitext(
    "wikitext/serializer#serializeInlineNodes",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/serializer");
      const { parseInlineLinksAndFormatting } = await import("~/lib/wiki-os/wikitext/link-parser");
      return (s) => m.serializeInlineNodes(parseInlineLinksAndFormatting(s));
    },
    bound(4, "a node per few characters, parsed and written back")
  ),
  wikitext(
    "wikitext/serializer#serializeTemplateToWikitext",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/serializer");
      const { scanTemplateAt } = await import("~/lib/wiki-os/wikitext/template-parser");
      return (s) => {
        const { parsed } = scanTemplateAt(`{{x|${s}}}`, 0); // closed, so there is a template to write (an unclosed one is not parsed)
        return parsed ? m.serializeTemplateToWikitext(parsed) : null;
      };
    },
    bound(
      16,
      "a record keyed by position per `|` (two million keys, each looked at three times), parsed and written back"
    )
  ),
  wikitext("wikitext/table-parser#splitBalancedDoubleTokens", async () => {
    const m = await import("~/lib/wiki-os/wikitext/table-parser");
    return (s) => [m.splitBalancedDoubleTokens(s, "||"), m.splitBalancedDoubleTokens(s, "!!")];
  }),
  wikitext("wikitext/table-parser#extractTableCellContent", async () => {
    const m = await import("~/lib/wiki-os/wikitext/table-parser");
    return (s) => m.extractTableCellContent(s);
  }),
  wikitext(
    "wikitext/table-parser#parseWikitable",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/table-parser");
      return (s) => m.parseWikitable(`{|\n${s}\n|}`);
    },
    bound(3, "a cell per few characters")
  ),
  wikitext(
    "wikitext/template-edit#readTemplateParams",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/template-edit");
      return (s) => m.readTemplateParams(`{{x|${s}}}`);
    },
    bound(5, "a parameter record per `|`")
  ),
  wikitext(
    "wikitext/template-edit#escapeParamValue",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/template-edit");
      return (s) => m.escapeParamValue(s);
    },
    linear(2, "it indexes the braces and the brackets of the whole text before it reads any of it")
  ),
  wikitext(
    "wikitext/template-edit#rewriteTemplateParams",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/template-edit");
      return (s) => {
        const third = s.slice(0, Math.floor(s.length / 3)); // the template and the values together are about the text's length
        return m.rewriteTemplateParams(`{{x|a=${third}|b=${third}}}`, { a: third, c: third });
      };
    },
    bound(5, "a parameter record per `|`, read and written back")
  ),
  wikitext(
    "wikitext/template-parser#scanTemplateAt",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/template-parser");
      return (s) => m.scanTemplateAt(`{{${s}`, 0);
    },
    bound(3, "a parameter record per `|`")
  ),
  wikitext(
    "wikitext/template-parser#scanTemplates",
    async () => {
      const m = await import("~/lib/wiki-os/wikitext/template-parser");
      return (s) => m.scanTemplates(s);
    },
    bound(4, "a template record per `{{`")
  ),

  // ---- transformers/ ---------------------------------------------------------------------------
  wikitext("transformers/clean-markup-passes#stripComments", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.stripComments(s);
  }),
  wikitext("transformers/clean-markup-passes#stripTagBlocks", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => [m.stripTagBlocks(s, "ref"), m.stripTagBlocks(s, "gallery")];
  }),
  wikitext("transformers/clean-markup-passes#stripSelfClosingRefs", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.stripSelfClosingRefs(s);
  }),
  wikitext("transformers/clean-markup-passes#stripNamespacedLinks", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => [m.stripNamespacedLinks(s, "category:"), m.stripNamespacedLinks(s, "template:")];
  }),
  wikitext("transformers/clean-markup-passes#replaceInlineTemplates", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) =>
      m.replaceInlineTemplates(
        s,
        /\{\{(?:flag|flagcountry|flagicon)\s*\|\s*([^|}]+)[^}]*\}\}/,
        (match: RegExpExecArray) => match[1] ?? ""
      );
  }),
  wikitext("transformers/clean-markup-passes#stripUnclosedTemplateTail", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.stripUnclosedTemplateTail(s);
  }),
  wikitext("transformers/clean-markup-passes#stripHtmlTags", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.stripHtmlTags(s);
  }),
  wikitext("transformers/clean-markup-passes#unpackExternalLinks", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.unpackExternalLinks(s);
  }),
  wikitext("transformers/clean-markup-passes#stripBareExternalLinks", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.stripBareExternalLinks(s);
  }),
  wikitext("transformers/clean-markup-passes#nextFileOpener", async () => {
    const m = await import("~/lib/wiki-os/transformers/clean-markup-passes");
    return (s) => m.nextFileOpener(s, 0);
  }),
  html("transformers/fix-editor-images#fixEditorImageUrls", async () => {
    const m = await import("~/lib/wiki-os/transformers/fix-editor-images");
    return (s) => m.fixEditorImageUrls(s);
  }),
  html("transformers/html-transformer#transformArticleHtml", async () => {
    const m = await import("~/lib/wiki-os/transformers/html-transformer");
    return (s) => m.transformArticleHtml(s, "/wiki");
  }),
  html("transformers/html-transformer#transformImages", async () => {
    const m = await import("~/lib/wiki-os/transformers/html-transformer");
    return (s) => m.transformImages(s);
  }),
  html("transformers/html-transformer#stripConflictingStyles", async () => {
    const m = await import("~/lib/wiki-os/transformers/html-transformer");
    return (s) => m.stripConflictingStyles(s);
  }),
  wikitext("transformers/image-url#isNoticeOrUtilityIcon", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.isNoticeOrUtilityIcon(s);
  }),
  wikitext("transformers/image-url#getMd5ShardPath", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.getMd5ShardPath(s);
  }),
  wikitext("transformers/image-url#getImageUrl", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.getImageUrl(s);
  }),
  wikitext("transformers/image-url#isWikimediaCommonsUrl", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.isWikimediaCommonsUrl(s);
  }),
  wikitext("transformers/image-url#getCommonsProxyUrl", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.getCommonsProxyUrl(s);
  }),
  wikitext("transformers/image-url#normalizeWikiImageUrl", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.normalizeWikiImageUrl(s);
  }),
  html("transformers/image-url#extractLeadImageFromHtml", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.extractLeadImageFromHtml(s);
  }),
  html("transformers/image-url#extractLeadImage", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.extractLeadImage(s);
  }),
  wikitext("transformers/image-url#heroImage", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.heroImage(s, 4000, 3000);
  }),
  wikitext("transformers/image-url#extractLeadImagePath", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.extractLeadImagePath(s);
  }),
  wikitext("transformers/image-url#resolveStoredImageUrl", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => [
      m.resolveStoredImageUrl(s),
      m.resolveStoredImageUrl(`/images/${s}`),
      m.getImagePath(s),
    ];
  }),
  wikitext("transformers/image-url#extractLeadImageFromWikitext", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => m.extractLeadImageFromWikitext(s);
  }),
  wikitext("transformers/image-url#resolveImageUrl", async () => {
    const m = await import("~/lib/wiki-os/transformers/image-url");
    return (s) => [m.resolveImageUrl(s), m.resolveImageUrl(s, "iiwiki")];
  }),
  wikitext("transformers/infobox-parser#parseCoordTemplate", async () => {
    const m = await import("~/lib/wiki-os/transformers/infobox-parser");
    return (s) => m.parseCoordTemplate(s);
  }),
  wikitext("transformers/infobox-parser#parsePopulation", async () => {
    const m = await import("~/lib/wiki-os/transformers/infobox-parser");
    return (s) => m.parsePopulation(s);
  }),
  wikitext("transformers/infobox-parser#cleanWikiValue", async () => {
    const m = await import("~/lib/wiki-os/transformers/infobox-parser");
    return (s) => m.cleanWikiValue(s);
  }),
  wikitext(
    "transformers/infobox-parser#parseInfobox",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/infobox-parser");
      return (s) => [m.parseInfobox(s), m.parseInfobox(`{{Infobox country\n| a = ${s}\n}}`)];
    },
    bound(2, "a field record per `|`")
  ),
  wikitext(
    "transformers/infobox-parser#renderInfoboxHtml",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/infobox-parser");
      return (s) => {
        const half = s.slice(0, s.length / 2); // two values: together they are the text's length
        const parsed = m.parseInfobox(
          `{{Infobox country\n| name = ${half}\n| capital = ${half}\n}}`
        );
        return parsed ? m.renderInfoboxHtml(parsed) : null;
      };
    },
    bound(2, "a field record per `|`")
  ),
  wikitext("transformers/infobox-parser#parseInfoboxToHtml", async () => {
    const m = await import("~/lib/wiki-os/transformers/infobox-parser");
    return (s) => m.parseInfoboxToHtml(s);
  }),
  wikitext("transformers/media-theme#detectMediaType", async () => {
    const m = await import("~/lib/wiki-os/transformers/media-theme");
    return (s) => m.detectMediaType(s);
  }),
  wikitext("transformers/media-theme#getImageIdentifier", async () => {
    const m = await import("~/lib/wiki-os/transformers/media-theme");
    return (s) => m.getImageIdentifier(s);
  }),
  wikitext("transformers/safe-decode#safeDecodeURI", async () => {
    const m = await import("~/lib/wiki-os/transformers/safe-decode");
    return (s) => m.safeDecodeURI(s);
  }),
  html("transformers/slim-html#slimArticleHtml", async () => {
    const m = await import("~/lib/wiki-os/transformers/slim-html");
    const { DOM_SIZE_CEILING } = await import("~/lib/wiki-os/transformers/inert-dom");
    // A page over the size ceiling is left as it is, without a DOM: the hostile text is padded to be one (the
    // runs on 200 KB would otherwise build a DOM). Without the ceiling this is the DOM-bound case below, at 1x.
    return (s) =>
      m.slimArticleHtml(
        s.length > DOM_SIZE_CEILING ? s : s + " ".repeat(DOM_SIZE_CEILING + 1 - s.length)
      );
  }),
  html(
    "transformers/slim-html#slimArticleHtml@ceiling",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/slim-html");
      return (s) => m.slimArticleHtml(s);
    },
    {
      // A page of more than 500,000 characters is left as it is (the target above); this is the most it tidies.
      maxChars: 500_000,
      slowFactor: 12,
      why: "jsdom builds a DOM at a few microseconds an element, so a page this long of one-character elements (`<br>`) takes a second: the DOM is the work",
    }
  ),
  wikitext("transformers/url-compat#titleToWikiOSPath", async () => {
    const m = await import("~/lib/wiki-os/transformers/url-compat");
    return (s) => m.titleToWikiOSPath(s);
  }),
  wikitext(
    "transformers/url-compat#titleToWikiOSRoute",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/url-compat");
      return (s) => m.titleToWikiOSRoute(s);
    },
    linear(2, "encodeURIComponent writes nine characters for each of these, and that is the work")
  ),
  html("transformers/url-compat#transformWikiLinks", async () => {
    const m = await import("~/lib/wiki-os/transformers/url-compat");
    return (s) => m.transformWikiLinks(s);
  }),
  wikitext(
    "transformers/wiki-ast-converter#wikitextToAst",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/wiki-ast-converter");
      return (s) => m.wikitextToAst(s);
    },
    bound(10, "several records per construct (nodes, then editor nodes)")
  ),
  wikitext(
    "transformers/wiki-ast-converter#astToWikitext@wikitextToAst",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/wiki-ast-converter");
      return (s) => m.astToWikitext(m.wikitextToAst(s));
    },
    bound(8, "several records per construct, converted and written back")
  ),
  wikitext(
    "transformers/wiki-ast-converter#astToHtml@wikitextToAst",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/wiki-ast-converter");
      return (s) => m.astToHtml(m.wikitextToAst(s));
    },
    bound(8, "several records per construct, converted to HTML")
  ),
  wikitext(
    "transformers/wiki-ast-converter#plateNodesToAst@astToPlateNodes",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/wiki-ast-converter");
      return (s) => m.plateNodesToAst(m.astToPlateNodes(m.wikitextToAst(s)));
    },
    bound(10, "several records per construct, converted to editor nodes and back")
  ),
  wikitext("transformers/wikitext-diff#diffWikitext", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-diff");
    return (s) => m.diffWikitext(s, `${s}\nx`);
  }),
  wikitext("transformers/wikitext-diff#diffWikitext@against-empty", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-diff");
    return (s) => m.diffWikitext("", s);
  }),
  wikitext("transformers/wikitext-diff#diffWikitext@shifted", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-diff");
    return (s) => m.diffWikitext(s, s.replaceAll("\n", "\ny\n"));
  }),
  wikitext("transformers/wikitext-parser#imageDimensionAttributes", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.imageDimensionAttributes([s, "thumb", s]);
  }),
  wikitext("transformers/wikitext-parser#stripWikitextFiles", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.stripWikitextFiles(s);
  }),
  wikitext("transformers/wikitext-parser#parseWikitextToHtml", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.parseWikitextToHtml(s, "ixwiki");
  }),
  wikitext(
    "transformers/wikitext-parser#parseWikitextToHtml@ceiling",
    async () => {
      const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
      return (s) => m.parseWikitextToHtml(s, "ixwiki");
    },
    {
      // 300,000 characters is the most it compiles (above that it copies the text, the target above): the
      // compile is tested at the size it is given.
      maxChars: 300_000,
      why: "COMPILE_CEILING",
    }
  ),
  wikitext("transformers/wikitext-parser#unpackInternalLinks", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.unpackInternalLinks(s);
  }),
  wikitext("transformers/wikitext-parser#cleanWikiMarkup", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.cleanWikiMarkup(s);
  }),
  wikitext("transformers/wikitext-parser#cleanWikiMarkup@excerpt", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.cleanWikiMarkup(s, 300);
  }),
  wikitext("transformers/wikitext-parser#cleanWikitextExcerpt", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.cleanWikitextExcerpt(s);
  }),
  wikitext("transformers/wikitext-parser#calculateRawTextBytes", async () => {
    const m = await import("~/lib/wiki-os/transformers/wikitext-parser");
    return (s) => m.calculateRawTextBytes(s);
  }),

  wikitext(
    "editor/parse-template-wikitext#parseTemplateWikitext",
    async () => {
      const m = await import("~/lib/wiki-os/editor/parse-template-wikitext");
      return (s) => [
        m.parseTemplateWikitext(`{{${s}}}`),
        m.parseTemplateWikitext(`[[${s}]]`, "T", "square"),
      ];
    },
    bound(10, "a parameter record per `|`")
  ),

  // ---- core/ -----------------------------------------------------------------------------------
  wikitext("core/redirect#parseRedirect", async () => {
    const m = await import("~/lib/wiki-os/core/redirect");
    return (s) => [
      m.parseRedirect(s),
      m.parseRedirect(`#REDIRECT [[${s}`),
      m.parseRedirect(`#REDIRECT [[${s}]]`),
    ];
  }),
  wikitext("core/title#canonicalizeTitle", async () => {
    const m = await import("~/lib/wiki-os/core/title");
    return (s) => m.canonicalizeTitle(s);
  }),
  wikitext("core/title#sameTitle", async () => {
    const m = await import("~/lib/wiki-os/core/title");
    return (s) => m.sameTitle(s, `${s}x`);
  }),
  wikitext("core/title#decodeTitleParam", async () => {
    const m = await import("~/lib/wiki-os/core/title");
    return (s) => m.decodeTitleParam(s);
  }),

  // ---- xml/ ------------------------------------------------------------------------------------
  wikitext("xml/content-model#contentModelFor", async () => {
    const m = await import("~/lib/wiki-os/xml/content-model");
    return (s) => m.contentModelFor(s);
  }),
  wikitext("xml/export-request#parseTitleList", async () => {
    const m = await import("~/lib/wiki-os/xml/export-request");
    return (s) => m.parseTitleList(s);
  }),
  wikitext("xml/export-request#exportQuery", async () => {
    const m = await import("~/lib/wiki-os/xml/export-request");
    return (s) => m.exportQuery(m.parseTitleList(s), false);
  }),
  wikitext("xml/export-writer#escapeXmlText", async () => {
    const m = await import("~/lib/wiki-os/xml/export-writer");
    return (s) => m.escapeXmlText(s);
  }),
  wikitext("xml/export-writer#escapeXmlAttribute", async () => {
    const m = await import("~/lib/wiki-os/xml/export-writer");
    return (s) => m.escapeXmlAttribute(s);
  }),
  wikitext("xml/export-writer#createExportWriter@page", async () => {
    const m = await import("~/lib/wiki-os/xml/export-writer");
    return async (s) => {
      let bytes = 0;
      const writer = m.createExportWriter((chunk: string) => {
        bytes += chunk.length;
      });
      await writer.start();
      await writer.page({
        title: s.slice(0, 200),
        ns: 0,
        pageId: 1,
        redirectTitle: null,
        revisions: (async function* () {
          yield {
            id: 1,
            parentId: null,
            timestamp: "2026-01-01T00:00:00Z",
            contributor: { username: "x", id: 1 },
            comment: s.slice(0, 200),
            commentDeleted: false,
            minor: false,
            model: "wikitext",
            format: "text/x-wiki",
            text: s,
            textDeleted: false,
            bytes: s.length,
            sha1: null,
          };
        })(),
      });
      await writer.end();
      return bytes;
    };
  }),
  wikitext("xml/fetch-dump#redirectTargetOf", async () => {
    const m = await import("~/lib/wiki-os/xml/fetch-dump");
    return (s) => [
      m.redirectTargetOf(s),
      m.redirectTargetOf(`#REDIRECT [[${s}`),
      m.redirectTargetOf(`#REDIRECT [[${s}]]`),
    ];
  }),
  wikitext("xml/import-validation#parseMwTimestamp", async () => {
    const m = await import("~/lib/wiki-os/xml/import-validation");
    return (s) => m.parseMwTimestamp(s);
  }),
  wikitext("xml/sha1#mwSha1Base36", async () => {
    const m = await import("~/lib/wiki-os/xml/sha1");
    return (s) => m.mwSha1Base36(s);
  }),
  xml("xml/import-reader#readExport", async () => {
    const m = await import("~/lib/wiki-os/xml/import-reader");
    return async (s) => {
      let events = 0;
      try {
        for await (const _event of m.readExport(chunksOf(s))) events++;
      } catch {
        // a malformed dump is refused: how fast is what is measured
      }
      return events;
    };
  }),

  // ---- templates/ ------------------------------------------------------------------------------
  html("templates/chip-markers#markTemplateChips", async () => {
    const m = await import("~/lib/wiki-os/templates/chip-markers");
    return (s) => m.markTemplateChips(s);
  }),
  html(
    "templates/chip-markers#markTemplateChips@ceiling",
    async () => {
      const m = await import("~/lib/wiki-os/templates/chip-markers");
      return (s) => m.markTemplateChips(`{{MyCountry:a}}${s}`); // a chip in it, or the DOM is never built
    },
    {
      // the 15 characters the driver adds keep it within DOM_SIZE_CEILING (500,000): a run over it is left alone, at once
      maxChars: 499_900,
      slowFactor: 12,
      why: "jsdom builds a DOM at a few microseconds an element, so a page this long of one-character elements (`<br>`) takes a second: the DOM is the work",
    }
  ),
  html("templates/chip-markers#chipKeysIn", async () => {
    const m = await import("~/lib/wiki-os/templates/chip-markers");
    return (s) => m.chipKeysIn(s, s);
  }),
  html("templates/chip-markers#substituteChipMarkers", async () => {
    const m = await import("~/lib/wiki-os/templates/chip-markers");
    return (s) => m.substituteChipMarkers(s, (key: string) => key);
  }),
  wikitext("templates/chip-markers#isMarkableKey", async () => {
    const m = await import("~/lib/wiki-os/templates/chip-markers");
    return (s) => m.isMarkableKey(`MyCountry:${s}`);
  }),
  html("templates/template-resolver#extractTemplateKeys", async () => {
    const m = await import("~/lib/wiki-os/templates/template-resolver");
    return (s) => m.extractTemplateKeys(s);
  }),
  wikitext("templates/template-resolver#makeChip", async () => {
    const m = await import("~/lib/wiki-os/templates/template-resolver");
    return (s) => m.makeChip(s, s);
  }),
  wikitext("templates/template-registry#isNoiseTemplate", async () => {
    const m = await import("~/lib/wiki-os/templates/template-registry");
    return (s) => m.isNoiseTemplate(s);
  }),
  wikitext("templates/template-registry#categorizeTemplate", async () => {
    const m = await import("~/lib/wiki-os/templates/template-registry");
    return (s) => m.categorizeTemplate("x", s);
  }),
  wikitext("templates/preview-service.server#canonicalPreviewInput", async () => {
    const m = await import("~/lib/wiki-os/templates/preview-service.server");
    return (s) => m.canonicalPreviewInput(s, { a: s });
  }),
  wikitext("templates/template-data-reader#extractTemplateDataJson", async () => {
    const m = await import("~/lib/wiki-os/templates/template-data-reader");
    return (s) => [m.extractTemplateDataJson(s), m.extractTemplateDataJson(`<templatedata>${s}`)];
  }),
  wikitext("templates/template-data-reader#parseTemplateData", async () => {
    const m = await import("~/lib/wiki-os/templates/template-data-reader");
    return (s) => m.parseTemplateData("x", s);
  }),

  // ---- api-compat/ (the api.php surface reads page text and request strings) -----------------------
  wikitext("api-compat/scan#linkTargets", async () => {
    const m = await import("~/lib/wiki-os/api-compat/scan");
    return (s) => m.linkTargets(s, 5001);
  }),
  wikitext("api-compat/scan#categoryLinks", async () => {
    const m = await import("~/lib/wiki-os/api-compat/scan");
    return (s) => m.categoryLinks(s, 1001);
  }),
  wikitext("api-compat/scan#externalUrls", async () => {
    const m = await import("~/lib/wiki-os/api-compat/scan");
    return (s) => m.externalUrls(s, 500);
  }),
  wikitext("api-compat/scan#visibleText", async () => {
    const m = await import("~/lib/wiki-os/api-compat/scan");
    return (s) => m.visibleText(s);
  }),
  wikitext("api-compat/params#splitMultiValue", async () => {
    const m = await import("~/lib/wiki-os/api-compat/params");
    return (s) => m.splitMultiValue(s);
  }),
  wikitext("api-compat/modules/list-common#canonicalTitle", async () => {
    const m = await import("~/lib/wiki-os/api-compat/modules/list-common");
    return (s) => [m.canonicalTitle(s), m.baseOf(s), m.titleIn(0, s)];
  }),
  wikitext("api-compat/modules/query-prop#displayTitleHtml", async () => {
    const m = await import("~/lib/wiki-os/api-compat/modules/query-prop");
    return (s) => m.displayTitleHtml(s);
  }),
  wikitext("api-compat/modules/query-prop#pagePropsOf", async () => {
    const m = await import("~/lib/wiki-os/api-compat/modules/query-prop");
    return (s) => [
      m.pagePropsOf(s),
      m.pagePropsOf(`{{DISPLAYTITLE:${s}`),
      m.pagePropsOf(`{{DEFAULTSORT:${s}`),
    ];
  }),
  wikitext("api-compat/modules/write-common#cleanComment", async () => {
    const m = await import("~/lib/wiki-os/api-compat/modules/write-common");
    return (s) => m.cleanComment(s);
  }),
  wikitext("api-compat/diff-table#diffTableHtml", async () => {
    const m = await import("~/lib/wiki-os/api-compat/diff-table");
    const { diffWikitext } = await import("~/lib/wiki-os/transformers/wikitext-diff");
    return (s) => m.diffTableHtml(diffWikitext(s, `${s}\nx`), 2 * 1024 * 1024);
  }),
  wikitext("api-compat/auth#readCookie", async () => {
    const m = await import("~/lib/wiki-os/api-compat/auth");
    return (s) => [
      m.readCookie(s, "a"),
      m.readCookie(`a=${s}`, "a"),
      m.splitBotLogin(s),
      m.readSessionCookie(s),
    ];
  }),
  wikitext("core/anonymous-author#isAnonymousAuthor", async () => {
    const m = await import("~/lib/wiki-os/core/anonymous-author");
    return (s) => m.isAnonymousAuthor(s);
  }),
  wikitext("namespace-policy#checkEditPolicy", async () => {
    const m = await import("~/lib/wiki-os/namespace-policy");
    return (s) => m.checkEditPolicy(s, { rights: new Set(), linkedWikiUsername: null });
  }),

  // ---- the helpers outside those folders that read page text (excerpt, lead image, category …) ---
  html("article-seo#descriptionFromHtml", async () => {
    const m = await import("~/lib/wiki-os/article-seo");
    return (s) => m.descriptionFromHtml(s);
  }),
  html("article-seo#leadImageUrl", async () => {
    const m = await import("~/lib/wiki-os/article-seo");
    return (s) => m.leadImageUrl(s, "https://ixwiki.com");
  }),
  html("main-page/lead-paragraph#leadParagraph", async () => {
    const m = await import("~/lib/wiki-os/main-page/lead-paragraph");
    return (s) => m.leadParagraph(s);
  }),
  html("main-page/featured-article#featuredArticleDetails", async () => {
    const m = await import("~/lib/wiki-os/main-page/featured-article");
    return (s) => m.featuredArticleDetails(s);
  }),
  wikitext("adapters/ixstates/infobox-mapper#parseInfoboxTemplate", async () => {
    const m = await import("~/lib/wiki-os/adapters/ixstates/infobox-mapper");
    return (s) => [
      m.parseInfoboxTemplate(s),
      m.parseInfoboxTemplate(`{{Infobox country\n| name = ${s}\n}}`),
    ];
  }),
  wikitext("adapters/ixstates/infobox-mapper#parseCoordinates", async () => {
    const m = await import("~/lib/wiki-os/adapters/ixstates/infobox-mapper");
    return (s) => m.parseCoordinates(s);
  }),
  wikitext(
    "adapters/ixstates/unified-parser#parseInfoboxWithTemplates",
    async () => {
      const m = await import("~/lib/wiki-os/adapters/ixstates/unified-parser");
      return (s) =>
        m.parseInfoboxWithTemplates(`{{Infobox country\n| name = ${s}\n| capital = x\n}}`);
    },
    {
      // It answers null for a text of more than 500,000 characters: it is run on the most it reads.
      maxChars: 499_000,
      why: "its own 500,000-character guard",
    }
  ),
  wikitext("adapters/ixstates/integration#cleanWikiSectionContent", async () => {
    const m = await import("~/lib/wiki-os/adapters/ixstates/integration");
    return (s) => m.cleanWikiSectionContent(s);
  }),
  wikitext("adapters/ixstates/integration#classifyWikiSection", async () => {
    const m = await import("~/lib/wiki-os/adapters/ixstates/integration");
    return (s) => m.classifyWikiSection(s);
  }),
  wikitext("adapters/mediawiki/bridge/dispatchers#extractIntroFromWikitext", async () => {
    const m = await import("~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers");
    return (s) => m.extractIntroFromWikitext(s);
  }),
];

// ---------------------------------------------------------------------------------------------------
// What is not here, and why
// ---------------------------------------------------------------------------------------------------

/** Exported functions that take page text and are not run, each with the reason. */
export const SKIPPED: ReadonlyArray<readonly [name: string, reason: string]> = [
  [
    "services/render-service#buildViewBundle",
    "imports the database client (module side effects); its parts (transformArticleHtml, slimArticleHtml, markTemplateChips) are targets",
  ],
  [
    "core/native-search-service#toMarkedSnippet",
    "imports the database client; it is cleanWikiMarkup (a target) and one linear loop",
  ],
  [
    "adapters/ixstates/cache-service#cleanWikitextForDisplay",
    "imports article-repository (database); a one-line call of cleanWikiMarkup (a target)",
  ],
  [
    "core/article-repository (deriveSaveFields, saves)",
    "database; not exported. Its text work is cleanWikitextExcerpt + parseRedirect (targets) and a whitespace word count",
  ],
  [
    "transformers/html-transformer#appendSectionEditLinks/removeSectionEditLinks",
    "take a DOM tree, not text; the cost is the DOM parse (slimArticleHtml, markTemplateChips targets)",
  ],
  ["transformers/resolve-highres-image#resolveHighResWikiImage", "takes DOM elements"],
  [
    "transformers/inert-dom#parseInert, server-dom#parseInertOnServer",
    "wrap an HTML parser (jsdom/browser); the same parse is in slimArticleHtml and markTemplateChips",
  ],
  [
    "transformers/plate-fingerprint, plate-marks, plate-node",
    "take Plate/AST node objects, not text",
  ],
  [
    "wikitext/protected-regions#findTagClose",
    "needs an OpenTag; driven through skipProtectedAt@every-opener",
  ],
  [
    "wikitext/template-parser#unclosedTemplateDiagnostic",
    "builds one message from numbers and a parsed template",
  ],
  [
    "wikitext/serializer#serializeBlockNodeToWikitext, serializeInlineNodeToWikitext",
    "node-level; driven through astToWikitext@parse and serializeInlineNodes",
  ],
  [
    "core/category-service, link-graph-service, article-repository, page-*-service, file-page-service, edit-conflict, archived-titles, sitemap-service, rights-admin-service, media-asset-service, intelligent-lore-cache",
    "database or cache I/O (and no text scan of their own)",
  ],
  [
    "core/parser-functions#ParserFunctionEvaluator",
    "evaluates already-split arguments; evalExpr sanitizes to arithmetic first",
  ],
  ["core/title-audit#auditTitles/renderFixSql", "take rows from the database"],
  [
    "xml/exporter#writeExport, importer#importExport, fetch-dump#fetchDump, upload-stream, dump-input",
    "database, network or file I/O",
  ],
  ["xml/import-reader#chunksOfStream", "adapts a web stream; readExport is the target"],
  [
    "xml/revision-plan#planRevisionImport",
    "plans over revision objects (hashes via mwSha1Base36, a target)",
  ],
  [
    "templates/template-registry#fetchTemplateData, searchTemplatesFromWiki, getTemplatePreview",
    "fetch from MediaWiki",
  ],
  [
    "templates/preview-service(.server)#renderTemplateCached, renderTemplateWithRedisCache",
    "cache and network I/O",
  ],
  [
    "adapters/mediawiki/**, adapters/ixstates/(eligible-country, user-sync, ixworld-mapper, lore-card-generator, entity-parser)",
    "database, fetch, or country objects rather than page text",
  ],
  [
    "services/** (article-view, revision-view, inbound-*, auto-sync, watchlist-notify, margin, main-page)",
    "database/fetch orchestration; the text work is in the targets above",
  ],
];

// ---------------------------------------------------------------------------------------------------
// Hostile inputs
// ---------------------------------------------------------------------------------------------------

export interface Family {
  name: string;
  /** The text, `size` characters long (the unit repeated and cut). */
  build: (size: number) => string;
  /** The families only an HTML or XML reader is fed. */
  only?: TargetKind;
}

const repeatTo = (unit: string, size: number): string =>
  unit.repeat(Math.ceil(size / unit.length)).slice(0, size);

/** The wikitext units, as the task lists them. */
const WIKITEXT_UNITS: ReadonlyArray<readonly [name: string, unit: string]> = [
  ["[[", "[["],
  ["]]", "]]"],
  ["{{", "{{"],
  ["}}", "}}"],
  ["[[File:", "[[File:"],
  ["[[Category: ", "[[Category: "],
  ["{{#invoke:", "{{#invoke:"],
  ["<nowiki␠", "<nowiki "],
  ["<nowiki>", "<nowiki>"],
  ["<ref", "<ref"],
  ["<ref>", "<ref>"],
  ["<!--", "<!--"],
  ["<pre>", "<pre>"],
  ["<blockquote>␤", "<blockquote>\n"],
  ["<blockquote>␤…</blockquote> x", "<blockquote>\n</blockquote> x"],
  ["<gallery", "<gallery"],
  ["'''", "'''"],
  ["''", "''"],
  ["|", "|"],
  ["||", "||"],
  ["==", "=="],
  ["=", "="],
  ["{|", "{|"],
  ["|-", "|-"],
  ["__TOC__", "__TOC__"],
  ["#REDIRECT [[", "#REDIRECT [["],
  ["&amp;", "&amp;"],
  ["&#", "&#"],
  ["U+00A0", "\u00a0"],
  ["U+2003", "\u2003"],
  ["U+3000", "\u3000"],
  ["emoji", "😀"],
  ["CRLF", "\r\n"],
  ["[[a|[[b|", "[[a|[[b|"],
  ["{{a|{{b|", "{{a|{{b|"],
  // not in the task's list, but each is the opener of one of the regular expressions in the compilers
  ["space", " "],
  ["LF", "\n"],
  ["LFLF", "\n\n"],
  ["a", "a"],
  ["* ", "* "],
  ["# ", "# "],
  [": ", ": "],
  ["----", "----"],
  ["<", "<"],
  [">", ">"],
  ["~~", "~~"],
  ["<s>", "<s>"],
  ["<u>", "<u>"],
  ["<code>", "<code>"],
  ["[http://a␠", "[http://a "],
  ["[http://a", "[http://a"],
  ["<references", "<references"],
  ["{{reflist", "{{reflist"],
  ["{{Infobox␠", "{{Infobox "],
  ["{{flag|", "{{flag|"],
  ["{{quote|", "{{quote|"],
  ["{{convert|1|", "{{convert|1|"],
  ["Template:", "Template:"],
  ["[[Template:", "[[Template:"],
  ["[blurb:", "[blurb:"],
  ['<ref␠name="', '<ref name="'],
  ["<math", "<math"],
  // numbers, and the openers of the expressions that read them
  ["1", "1"],
  ["1,", "1,"],
  ["-1", "-1"],
  ["1.", "1."],
  ["1 |", "1 |"],
  ["{{coord|", "{{coord|"],
  ["{{formatnum:", "{{formatnum:"],
  ["http://a.b/", "http://a.b/"],
  ["[[Image:", "[[Image:"],
  ["[[Media:", "[[Media:"],
  ["&", "&"],
  ["#", "#"],
  ["!", "!"],
  ["!!", "!!"],
  ["|}", "|}"],
  ["LF|", "\n|"],
  ["LF|-LF", "\n|-\n"],
  ['style="a" |', 'style="a" |'],
  // constructs that do close, many times over
  ["[[a]]", "[[a]]"],
  ["[[a|b]]", "[[a|b]]"],
  ["{{a}}", "{{a}}"],
  ["{{a|b=c}}", "{{a|b=c}}"],
  ["<ref>a</ref>", "<ref>a</ref>"],
  ["<!-- a -->", "<!-- a -->"],
  ["<nowiki>a</nowiki>", "<nowiki>a</nowiki>"],
  ["'''a'''", "'''a'''"],
  ["[http://a b]", "[http://a b]"],
];

/** `[[Category:` and then only spaces: a name of nothing but blanks. */
const CATEGORY_THEN_SPACES: Family = {
  name: "[[Category:␠×N",
  build: (size) => `[[Category:${" ".repeat(Math.max(0, size - 11))}`,
};

/** `prefix`, then `open` as many times as the size allows and `close` as many: nested, and balanced, to the depth the size gives. */
const nested = (name: string, open: string, close: string, prefix = ""): Family => ({
  name,
  build: (size) => {
    const depth = Math.floor((size - prefix.length) / (open.length + close.length));
    return prefix + open.repeat(depth) + close.repeat(depth);
  },
});

/** The HTML units, for the functions that read rendered HTML. */
const HTML_UNITS: ReadonlyArray<readonly [name: string, unit: string]> = [
  ['<a href="', '<a href="'],
  ['<a href="/wiki/', '<a href="/wiki/'],
  ['<a href="Template:MyCountry:', '<a href="Template:MyCountry:'],
  ["Template:MyCountry:", "Template:MyCountry:"],
  ["{{MyCountry:", "{{MyCountry:"],
  ["<a>", "<a>"],
  ["</a>", "</a>"],
  ["<img␠", "<img "],
  ['<img src="', '<img src="'],
  ['<div class="', '<div class="'],
  ["<div>", "<div>"],
  ["</div>", "</div>"],
  ["<p>", "<p>"],
  ["</p>", "</p>"],
  ["<span␠", "<span "],
  ["<table>", "<table>"],
  ["<style>", "<style>"],
  ["<style", "<style"],
  ['<h2><span class="mw-headline" id="', '<h2><span class="mw-headline" id="'],
  ['<sup class="reference">', '<sup class="reference">'],
  ["<figure>", "<figure>"],
  ["<li>", "<li>"],
  ['style="', 'style="'],
  ['<span data-wikios-chip="', '<span data-wikios-chip="'],
  ["&nbsp;", "&nbsp;"],
  ["<br>", "<br>"],
  ['"', '"'],
  ["<td>", "<td>"],
  ["<b>", "<b>"],
  ['data-file-width="', 'data-file-width="'],
  ['<div␠class="infobox">', '<div class="infobox">'],
  ['<div class="hatnote">', '<div class="hatnote">'],
  ['<div class="mw-parser-output">', '<div class="mw-parser-output">'],
  ['<div class="hatnote">a</div>', '<div class="hatnote">a</div>'],
  [
    '<table class="ambox"><tr><td>a</td></tr></table>',
    '<table class="ambox"><tr><td>a</td></tr></table>',
  ],
  ['<img src="a.png" width="10">', '<img src="a.png" width="10">'],
  ['<a href="/wiki/A">a</a>', '<a href="/wiki/A">a</a>'],
  ['<h2 id="a">a</h2>', '<h2 id="a">a</h2>'],
  ["<p>a</p><p>", "<p>a</p><p>"],
  ["<p>text</p>", "<p>text</p>"],
  ["<script", "<script"],
  // blocks that are siblings, a line each (a whitespace-only text between them is dead weight to take out)
  ["<p>x</p>␤", "<p>x</p>\n"],
  ["<li>a</li>␤", "<li>a</li>\n"],
  ["<div>a</div>␤", "<div>a</div>\n"],
  ["<blockquote>a</blockquote>␤", "<blockquote>a</blockquote>\n"],
  // chips that become markers, one node replaced each
  [
    '<a href="/wiki/Template:CountryData:C:population">x</a>␠',
    '<a href="/wiki/Template:CountryData:C:population">x</a> ',
  ],
  ["<p>{{CountryData:C:population}}</p>", "<p>{{CountryData:C:population}}</p>"],
  // an opener and a closing tag of another name, which closes nothing: nested as deep as it is long
  ["<s></i>", "<s></i>"],
];

/** The XML units, for the dump reader. */
const XML_UNITS: ReadonlyArray<readonly [name: string, unit: string]> = [
  ["<page>", "<page>"],
  ["<revision>", "<revision>"],
  ["<text>", "<text>"],
  ["<![CDATA[", "<![CDATA["],
  ["&lt;", "&lt;"],
  ["<?x", "<?x"],
  ["<x>", "<x>"],
  ["<!DOCTYPE", "<!DOCTYPE"],
];

/** mulberry32: the same seed gives the same soup on every run and every machine. */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fragment that would be well formed on its own: a soup holds those too, not only openers. */
const WELL_FORMED = [
  "[[Target|label]]",
  "[[Target]]",
  "{{tmpl|a=b|c}}",
  "[[File:A.png|thumb|300px|caption [[x]]]]",
  "[[Category:Things]]",
  "<ref name=a>text</ref>",
  "<ref name=a />",
  "<nowiki>[[x]]</nowiki>",
  "<!-- note -->",
  "'''bold''' and ''italic''",
  "== Heading ==",
  "\n{|\n|-\n| a || b\n|}\n",
  "* item\n",
  "# item\n",
  "http://example.com/a",
  "[http://example.com label]",
  "word ",
  "\n",
];

const soup = (units: readonly string[], seed: number) => (size: number) => {
  const next = prng(seed);
  const pieces: string[] = [];
  let length = 0;
  while (length < size) {
    const unit = units[Math.floor(next() * units.length)]!;
    pieces.push(unit);
    length += unit.length;
  }
  return pieces.join("").slice(0, size);
};

const WIKITEXT_UNIT_TEXTS = WIKITEXT_UNITS.map(([, unit]) => unit);
const HTML_UNIT_TEXTS = HTML_UNITS.map(([, unit]) => unit);
const XML_UNIT_TEXTS = XML_UNITS.map(([, unit]) => unit);

/** Every family of hostile text, in the order they run. */
export const FAMILIES: readonly Family[] = [
  ...WIKITEXT_UNITS.map(([name, unit]) => ({
    name,
    build: (size: number) => repeatTo(unit, size),
  })),
  CATEGORY_THEN_SPACES,
  nested("{{a|…}}", "{{a|", "}}"),
  nested("[[…]]", "[[", "]]"),
  // a literal `<!--` that never closes (in a nowiki, say), and links after it that all close
  nested("<nowiki><!--</nowiki>[[…]]", "[[", "]]", "<nowiki><!--</nowiki>"),
  { name: "soup:openers#1", build: soup(WIKITEXT_UNIT_TEXTS, 1) },
  { name: "soup:openers#2", build: soup(WIKITEXT_UNIT_TEXTS, 2) },
  { name: "soup:openers#3", build: soup(WIKITEXT_UNIT_TEXTS, 3) },
  { name: "soup:mixed#4", build: soup([...WIKITEXT_UNIT_TEXTS, ...WELL_FORMED], 4) },
  { name: "soup:mixed#5", build: soup([...WIKITEXT_UNIT_TEXTS, ...WELL_FORMED], 5) },
  { name: "soup:wellformed#6", build: soup(WELL_FORMED, 6) },
  ...HTML_UNITS.map(([name, unit]) => ({
    name,
    build: (size: number) => repeatTo(unit, size),
    only: "html" as const,
  })),
  { name: "soup:html#7", build: soup([...HTML_UNIT_TEXTS, ...WELL_FORMED], 7), only: "html" },
  {
    name: "soup:html#8",
    build: soup([...HTML_UNIT_TEXTS, ...WIKITEXT_UNIT_TEXTS], 8),
    only: "html",
  },
  ...XML_UNITS.map(([name, unit]) => ({
    name,
    build: (size: number) => repeatTo(unit, size),
    only: "xml" as const,
  })),
  { name: "soup:xml#9", build: soup([...XML_UNIT_TEXTS, ...WELL_FORMED], 9), only: "xml" },
];

/** The families a target of `kind` is fed: wikitext ones for all, HTML ones for HTML, XML ones for XML. */
export function familiesFor(kind: TargetKind): Family[] {
  return FAMILIES.filter((family) => !family.only || family.only === kind);
}

/**
 * What a dump reader is fed: an export `size` characters long that holds `family` text (escaped) in a
 * revision, so the reader gets as far as the text; the XML-only families go in raw instead.
 */
export function xmlInput(family: Family, size: number): string {
  if (family.only === "xml") return family.build(size);
  const open =
    '<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" version="0.11"><page><title>A</title><ns>0</ns><id>1</id><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><contributor><username>x</username><id>1</id></contributor><text xml:space="preserve">';
  const close = "</text></revision></page></mediawiki>";
  // Escaped (`<` is `&lt;`) and cut back to `size`: the dump is as long as the texts the other functions read.
  const body = family.build(size).replaceAll("&", "&amp;").replaceAll("<", "&lt;").slice(0, size);
  return open + body + close;
}

/** The input of `family` for a target of `kind`, `size` characters (an XML dump a little longer). */
export function inputFor(kind: TargetKind, family: Family, size: number): string {
  return kind === "xml" ? xmlInput(family, size) : family.build(size);
}

/** `text` in 64 KB chunks, as an upload stream yields it. */
async function* chunksOf(text: string): AsyncGenerator<string> {
  for (let at = 0; at < text.length; at += 65_536) yield text.slice(at, at + 65_536);
}
