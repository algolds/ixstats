/** @jest-environment node */
// Plan 415 re-review: `WIKIOS_TEMPLATESTYLES=0` is the emergency lever if a CSS bypass is reported. Off, the article
// sanitizer removes every `<style>` again (the behaviour before plan 415); on (the default), it keeps TemplateStyles'
// own, scoped. The setting is read once into wikiosConfig and is part of the sanitizer fingerprint, so a toggle makes
// every stored bundle re-render. The config is built when its module loads, so each mode loads the modules afresh.
const PAGE =
  '<style data-mw-deduplicate="TemplateStyles:r1">.box{color:red}</style><style>.plain{color:blue}</style>' +
  '<div class="box">Text</div>';

interface Sanitizer {
  html: string;
  fingerprint: string;
  enabled: boolean;
}

function loadWith(value: string | undefined): Sanitizer {
  const previous = process.env.WIKIOS_TEMPLATESTYLES;
  if (value === undefined) delete process.env.WIKIOS_TEMPLATESTYLES;
  else process.env.WIKIOS_TEMPLATESTYLES = value;
  try {
    let loaded: Sanitizer | null = null;
    jest.isolateModules(() => {
      const sanitizer =
        require("~/lib/utils/sanitize-html") as typeof import("~/lib/utils/sanitize-html");
      const config = require("~/lib/wiki-os/config") as typeof import("~/lib/wiki-os/config");
      loaded = {
        html: sanitizer.sanitizeWikiArticleHtml(PAGE),
        fingerprint: sanitizer.wikiArticleSanitizerFingerprint(),
        enabled: config.wikiosConfig.templateStyles,
      };
    });
    if (!loaded) throw new Error("the sanitizer did not load");
    return loaded;
  } finally {
    if (previous === undefined) delete process.env.WIKIOS_TEMPLATESTYLES;
    else process.env.WIKIOS_TEMPLATESTYLES = previous;
  }
}

describe("WIKIOS_TEMPLATESTYLES", () => {
  const on = loadWith(undefined);

  it("is on by default: TemplateStyles' <style> stays, scoped to the article root, and any other <style> goes", () => {
    expect(on.enabled).toBe(true);
    expect(on.html).toContain(
      '<style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .box{color:red}</style>'
    );
    expect(on.html).not.toContain("plain");
    expect(on.html).toContain('<div class="box">Text</div>');
  });

  it.each(["0", "false", "off", "no", " 0 ", "OFF", "anything", "tru", "disabled"])(
    "%j turns it off, a typo included: no <style> survives, the markup does",
    (value) => {
      const off = loadWith(value);

      expect(off.enabled).toBe(false);
      expect(off.html).toBe('<div class="box">Text</div>');
    }
  );

  it.each(["1", "", "on", "true", "yes", "TRUE", " Yes "])("%j leaves it on", (value) => {
    const same = loadWith(value);

    expect(same.enabled).toBe(true);
    expect(same.html).toBe(on.html);
    expect(same.fingerprint).toBe(on.fingerprint);
  });

  it("changes the sanitizer fingerprint, so stored bundles are re-rendered when it is toggled", () => {
    const off = loadWith("0");

    expect(off.fingerprint).not.toBe(on.fingerprint);
    expect(loadWith("0").fingerprint).toBe(off.fingerprint);
  });
});
