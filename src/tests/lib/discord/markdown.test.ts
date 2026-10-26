/** @jest-environment node */
/**
 * A wiki embed sent to Discord links the page in the WikiOS reader on the app URL (`wikiPermalink`), with `?source=`
 * for a sister wiki, and names the wiki it is from. Both the XML path and the regex fallback do this.
 */
import { htmlToDiscordMarkdown } from "~/lib/discord/markdown";

const KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL", "BASE_PATH", "NEXT_PUBLIC_BASE_PATH"] as const;
const env = process.env as Record<string, string | undefined>;
const saved = KEYS.map((key) => [key, env[key]] as const);
const APP = "https://ixwiki.com/projects/ixstates";

beforeEach(() => {
  for (const key of KEYS) delete env[key];
  env.NEXT_PUBLIC_APP_URL = APP;
  env.BASE_PATH = "/projects/ixstates";
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

const embed = (source: string) =>
  `<div data-wikiembed="true" data-title="Pax Atomica" data-summary="A peace." data-imageurl="" data-source="${source}"></div>`;
// An unclosed tag the XML parser refuses, so the regex fallback renders the embed.
const BROKEN = "<p>a <b>b</p>";

describe("Discord wiki embeds carry the source", () => {
  it.each([
    ["the XML path", ""],
    ["the regex fallback", BROKEN],
  ])(
    "a sister embed links to the reader with ?source= on the app URL and names the wiki (%s)",
    (_label, prefix) => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const althistory = htmlToDiscordMarkdown(prefix + embed("althistory"));
      expect(althistory).toContain(
        `**Wiki Embed: [Pax Atomica](${APP}/wiki/Pax_Atomica?source=althistory)**`
      );
      expect(althistory).toContain("*Source: AltHistory Wiki*");

      const iiwiki = htmlToDiscordMarkdown(prefix + embed("iiwiki"));
      expect(iiwiki).toContain(`(${APP}/wiki/Pax_Atomica?source=iiwiki)`);
      expect(iiwiki).toContain("*Source: IIWiki*");
      // the fallback case really is the fallback: the XML parser refused it
      expect(warn.mock.calls.length > 0).toBe(prefix === BROKEN);
      warn.mockRestore();
    }
  );

  it.each([["ixwiki"], ["evil"], [""]])(
    "an embed from IxWiki (or a source the reader does not know: %p) links the bare reader path",
    (source) => {
      const markdown = htmlToDiscordMarkdown(embed(source));
      expect(markdown).toContain(`**Wiki Embed: [Pax Atomica](${APP}/wiki/Pax_Atomica)**`);
      expect(markdown).toContain("*Source: Wiki*");
      expect(markdown).not.toContain("source=");
    }
  );

  it("an embed whose title would climb out of /wiki/ is named with no link", () => {
    const markdown = htmlToDiscordMarkdown(embed("iiwiki").replace("Pax Atomica", ".."));
    expect(markdown).toContain("**Wiki Embed: ..**");
    expect(markdown).not.toContain("](");
  });

  it.each([
    ["the XML path", ""],
    ["the regex fallback", BROKEN],
  ])(
    "a title's brackets, parentheses, backslashes and emphasis are escaped, so the link stays whole (%s)",
    (_label, prefix) => {
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const title = "A] (x) [b](https://evil.example) \\*c*_d_~e~ `f` ||g||";
      const markdown = htmlToDiscordMarkdown(
        prefix + embed("iiwiki").replace("Pax Atomica", title)
      );
      const escaped =
        "A\\] \\(x\\) \\[b\\]\\(https://evil.example\\) \\\\\\*c\\*\\_d\\_\\~e\\~ \\`f\\` \\|\\|g\\|\\|";
      const url = `${APP}/wiki/A%5D_%28x%29_%5Bb%5D%28https%3A%2F%2Fevil.example%29_%5C*c*_d_~e~_%60f%60_%7C%7Cg%7C%7C?source=iiwiki`;
      expect(markdown).toContain(`**Wiki Embed: [${escaped}](${url})**`);
      jest.restoreAllMocks();
    }
  );

  it("a title with parentheses keeps them inside the URL, percent-encoded", () => {
    const markdown = htmlToDiscordMarkdown(embed("ixwiki").replace("Pax Atomica", "Foo (bar)"));
    expect(markdown).toContain(`[Foo \\(bar\\)](${APP}/wiki/Foo_%28bar%29)`);
  });

  it("a title named with no link is escaped too", () => {
    const markdown = htmlToDiscordMarkdown(embed("iiwiki").replace("Pax Atomica", "../*x*"));
    expect(markdown).toContain(String.raw`**Wiki Embed: ../\*x\***`);
  });

  it("a composer link to a sister page keeps its ?source= on the app URL", () => {
    expect(
      htmlToDiscordMarkdown('<p><a href="/wiki/Gallambria?source=iiwiki">G</a></p>')
    ).toContain(`[G](${APP}/wiki/Gallambria?source=iiwiki)`);
  });
});
