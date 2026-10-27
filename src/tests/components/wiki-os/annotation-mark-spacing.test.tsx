/**
 * A saved quote often starts or ends mid-word ("ght him into"), and its highlight mark sits inside
 * that word. The mark must add no text and no inline spacing, or the word reads with a space in it.
 */
import fs from "fs";
import path from "path";
import { renderHook } from "@testing-library/react";
import { useAnnotationOverlay } from "~/components/wiki-os/reader/AnnotationOverlay";

const ARTICLE = "<p>Eleglass's victory <a href='#'>brou</a>ght him into favor with the Prince.</p>";

function highlight(selectedText: string) {
  const container = document.createElement("div");
  container.innerHTML = ARTICLE;
  const contentRef = { current: container };
  renderHook(() =>
    useAnnotationOverlay({
      contentRef,
      annotations: [{ id: "a1", selectedText, color: "#f472b6" }],
    })
  );
  return container;
}

describe("annotation marks", () => {
  it("wraps a quote that starts mid-word, across an inline link, without changing the text", () => {
    const container = highlight("ght him into");
    const mark = container.querySelector("mark.wikios-annotation-mark");
    expect(mark?.textContent).toBe("ght him into");
    expect(container.textContent).toBe(
      "Eleglass's victory brought him into favor with the Prince."
    );
  });

  it("carries no horizontal padding or margin in the stylesheet", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../../styles/wiki-os/components.css"),
      "utf8"
    );
    const rule = /mark\.wikios-annotation-mark,\s*\.wikios-annotation-mark\s*\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    const body = rule![1]!.replace(/\/\*[\s\S]*?\*\//g, "");
    const padding = /padding:\s*([^;]+);/.exec(body)?.[1]?.trim().split(/\s+/) ?? [];
    // `padding: <block> <inline>` — the inline part (the second value, or the only one) must be 0.
    expect(padding[1] ?? padding[0] ?? "0").toBe("0");
    expect(body).not.toMatch(/(^|[\s;])margin(-inline|-left|-right)?\s*:/);
  });
});
