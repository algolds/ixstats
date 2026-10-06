/**
 * Plan 413: a search snippet is text plus character ranges; the matches are marked, nothing is parsed as HTML.
 */
import { render } from "@testing-library/react";
import { HighlightedSnippet } from "~/components/wiki-os/shared/HighlightedSnippet";

describe("HighlightedSnippet", () => {
  it("marks exactly the given ranges", () => {
    const text = "The kingdom of Burgundie and its second city";
    const at = (word: string): [number, number] => [
      text.indexOf(word),
      text.indexOf(word) + word.length,
    ];
    const { container } = render(
      <HighlightedSnippet text={text} ranges={[at("kingdom"), at("second")]} />
    );

    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual([
      "kingdom",
      "second",
    ]);
    expect(container.textContent).toBe("The kingdom of Burgundie and its second city");
  });

  it("is the plain text without ranges, and never turns the text into markup", () => {
    const hostile = "<img src=x onerror=alert(1)> <b>kingdom</b>";
    const { container, rerender } = render(<HighlightedSnippet text={hostile} />);
    expect(container.textContent).toBe(hostile);
    expect(container.querySelector("img, b, mark")).toBeNull();

    const start = hostile.indexOf("kingdom");
    rerender(<HighlightedSnippet text={hostile} ranges={[[start, start + 7]]} />);
    expect(container.querySelector("img, b")).toBeNull();
    expect(container.querySelector("mark")?.textContent).toBe("kingdom");
  });

  it("skips a range that overlaps the previous one or lies outside the text", () => {
    const { container } = render(
      <HighlightedSnippet
        text="abcdef"
        ranges={[
          [1, 3],
          [2, 4],
          [5, 99],
          [4, 4],
        ]}
      />
    );

    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["bc"]);
    expect(container.textContent).toBe("abcdef");
  });
});
