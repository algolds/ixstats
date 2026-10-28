/**
 * Inline spoilers in ThinkPages posts: `||text||` becomes a spoiler span in the formatter's plain and HTML paths,
 * stays escaped inside, never spans or enters a tag, and the sanitizer adds nothing for it beyond the spoiler
 * attributes. One delegated handler reveals a spoiler on click or Enter.
 */
import { formatThinkpagesContentForDisplay } from "~/lib/utils/text-formatter";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
import { SPOILER_LABEL, maskSpoilers, revealSpoilerFromEvent } from "~/lib/thinkpages/spoilers";

/** The rendered HTML as a DOM fragment. */
function render(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

const spoilersIn = (html: string) => Array.from(render(html).querySelectorAll("[data-spoiler]"));

describe("formatThinkpagesContentForDisplay spoilers, plain text", () => {
  it("wraps ||text|| in a spoiler span with the reveal attributes", () => {
    const [spoiler, ...rest] = spoilersIn(formatThinkpagesContentForDisplay("a ||secret|| b"));
    expect(rest).toHaveLength(0);
    expect(spoiler!.tagName).toBe("SPAN");
    expect(spoiler!.textContent).toBe("secret");
    expect(spoiler!.getAttribute("role")).toBe("button");
    expect(spoiler!.getAttribute("tabindex")).toBe("0");
    expect(spoiler!.getAttribute("aria-label")).toBe(SPOILER_LABEL);
  });

  it("adds only the spoiler attributes", () => {
    const [spoiler] = spoilersIn(formatThinkpagesContentForDisplay("||secret||"));
    expect(Array.from(spoiler!.attributes, (attr) => attr.name).sort()).toEqual(
      ["aria-label", "data-spoiler", "role", "tabindex"].sort()
    );
  });

  it("matches each pair on its own and never across a line break", () => {
    expect(
      spoilersIn(formatThinkpagesContentForDisplay("||one|| and ||two||")).map((s) => s.textContent)
    ).toEqual(["one", "two"]);
    expect(spoilersIn(formatThinkpagesContentForDisplay("||one\ntwo||"))).toHaveLength(0);
    expect(spoilersIn(formatThinkpagesContentForDisplay("|| ||| ||"))).toHaveLength(1);
  });

  it("keeps markup inside a spoiler escaped", () => {
    // No tag the stored-HTML check knows, so this is the plain path: escaped, then wrapped.
    const markup = "<script>x()</script><svg onload=alert(1)><iframe src=javascript:alert(1)>";
    const html = formatThinkpagesContentForDisplay(`||${markup}||`);
    const root = render(html);
    expect(root.querySelector("script, svg, iframe")).toBeNull();
    expect(html).not.toMatch(/<script|<svg|<iframe/i);
    expect(root.querySelector("[data-spoiler]")!.textContent).toBe(markup);
  });

  it("still formats inside a spoiler", () => {
    const [spoiler] = spoilersIn(formatThinkpagesContentForDisplay("||**bold** #tag||"));
    expect(spoiler!.querySelector("strong")!.textContent).toBe("bold");
  });
});

describe("formatThinkpagesContentForDisplay spoilers, stored HTML", () => {
  it("wraps ||text|| within a text node", () => {
    const html = formatThinkpagesContentForDisplay("<p>a ||secret|| b</p>");
    const root = render(html);
    const spoiler = root.querySelector("p > span[data-spoiler]");
    expect(spoiler!.textContent).toBe("secret");
    expect(spoiler!.getAttribute("role")).toBe("button");
    expect(root.querySelector("p")!.textContent).toBe("a secret b");
  });

  it("does not match across tags", () => {
    expect(
      spoilersIn(formatThinkpagesContentForDisplay("<p>||a <strong>b</strong> c||</p>"))
    ).toHaveLength(0);
    expect(spoilersIn(formatThinkpagesContentForDisplay("<p>||a</p><p>b||</p>"))).toHaveLength(0);
  });

  it("does not match inside an attribute", () => {
    const html = formatThinkpagesContentForDisplay(
      '<p><a href="https://example.com/||x||" title="||y||">link</a></p>'
    );
    expect(spoilersIn(html)).toHaveLength(0);
    expect(render(html).querySelector("a")!.getAttribute("title")).toBe("||y||");
  });

  it("keeps escaped markup inside a spoiler escaped", () => {
    const html = formatThinkpagesContentForDisplay(
      "<p>||&lt;script&gt;alert(1)&lt;/script&gt;||</p>"
    );
    const root = render(html);
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("[data-spoiler]")!.textContent).toBe("<script>alert(1)</script>");
  });

  it("leaves a tag between the bars to the sanitizer", () => {
    const html = formatThinkpagesContentForDisplay("<p>||<img src=x onerror=alert(1)>||</p>");
    expect(spoilersIn(html)).toHaveLength(0);
    expect(html).not.toContain("onerror");
  });

  it("decorates a spoiler span written in stored HTML, and drops a script attribute on it", () => {
    const html = formatThinkpagesContentForDisplay(
      '<p><span data-spoiler="" onclick="alert(1)" role="link" tabindex="5">x</span></p>'
    );
    const [spoiler] = spoilersIn(html);
    expect(spoiler!.getAttribute("onclick")).toBeNull();
    expect(spoiler!.getAttribute("role")).toBe("button");
    expect(spoiler!.getAttribute("tabindex")).toBe("0");
  });
});

describe("sanitizeUserContent and spoiler attributes", () => {
  it("keeps data-spoiler; data-revealed is the reader's own and never stored", () => {
    const span = render(
      sanitizeUserContent('<span data-spoiler="" data-revealed="">x</span>')
    ).querySelector("span")!;
    expect(span.hasAttribute("data-spoiler")).toBe(true);
    expect(span.hasAttribute("data-revealed")).toBe(false);
  });

  it("still strips event handlers from a spoiler", () => {
    const html = sanitizeUserContent(
      '<span data-spoiler="" onclick="alert(1)" onmouseover="alert(2)">x</span>'
    );
    expect(html).not.toMatch(/onclick|onmouseover|alert/);
  });

  it("is not widened: role and tabindex in user HTML are dropped", () => {
    const span = render(
      sanitizeUserContent('<span role="button" tabindex="0" data-spoiler="">x</span>')
    ).querySelector("span")!;
    expect(span.getAttribute("role")).toBeNull();
    expect(span.getAttribute("tabindex")).toBeNull();
  });
});

describe("revealSpoilerFromEvent", () => {
  function mount() {
    const container = render(formatThinkpagesContentForDisplay("a ||secret|| b"));
    document.body.appendChild(container);
    container.addEventListener("click", revealSpoilerFromEvent);
    container.addEventListener("keydown", revealSpoilerFromEvent);
    const spoiler = container.querySelector<HTMLElement>("[data-spoiler]")!;
    const outer = jest.fn();
    document.body.addEventListener("click", outer);
    document.body.addEventListener("keydown", outer);
    return {
      container,
      spoiler,
      outer,
      cleanup: () => {
        document.body.removeEventListener("click", outer);
        document.body.removeEventListener("keydown", outer);
        container.remove();
      },
    };
  }

  it("reveals a spoiler on click, turns it into plain text and keeps the click from the post", () => {
    const { spoiler, outer, cleanup } = mount();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    spoiler.dispatchEvent(click);
    expect(spoiler.hasAttribute("data-revealed")).toBe(true);
    expect(spoiler.getAttribute("role")).toBeNull();
    expect(spoiler.getAttribute("tabindex")).toBeNull();
    expect(spoiler.getAttribute("aria-label")).toBeNull();
    expect(click.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    cleanup();
  });

  it("reveals a spoiler on Enter and Space, and ignores other keys", () => {
    for (const key of ["Enter", " "]) {
      const { spoiler, cleanup } = mount();
      spoiler.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      expect(spoiler.hasAttribute("data-revealed")).toBe(true);
      cleanup();
    }
    const { spoiler, outer, cleanup } = mount();
    spoiler.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(spoiler.hasAttribute("data-revealed")).toBe(false);
    expect(outer).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("lets a click on a revealed spoiler or outside one through", () => {
    const { container, spoiler, outer, cleanup } = mount();
    spoiler.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    spoiler.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    container.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(outer).toHaveBeenCalledTimes(2);
    cleanup();
  });
});

describe("maskSpoilers", () => {
  it("hides spoiler text in plain-text previews", () => {
    expect(maskSpoilers("The king ||dies|| at the end")).toBe("The king (spoiler) at the end");
  });
});
