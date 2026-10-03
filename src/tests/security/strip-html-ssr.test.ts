/**
 * @jest-environment node
 */
import { stripHtml } from "~/lib/utils/sanitize-html";

describe("stripHtml() without a DOM (SSR)", () => {
  it("has no window", () => {
    expect(typeof window).toBe("undefined");
  });

  it("decodes entities and spaces block tags exactly as the browser path does", () => {
    expect(stripHtml("<p>Fish &amp; chips<br>&quot;cod&quot; &#8211; &hellip;</p>")).toBe(
      'Fish & chips "cod" – …'
    );
    expect(stripHtml("A<br>B")).toBe("A B");
    expect(stripHtml("a&nbsp;&nbsp;b")).toBe("a b");
  });
});
