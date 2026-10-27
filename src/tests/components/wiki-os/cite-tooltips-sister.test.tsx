/**
 * C4b carry (plan 2026-10-25 sister wikis, Task 11, from Task 5): a sister reader page's ids are prefixed `sister-`, so
 * its citation links point at `#sister-cite_note-…`. The hover tooltip still finds the note, and shows its HTML (another
 * wiki's) inside the same containment as the article (`.wikios-sister-article`). An IxWiki note is not boxed in.
 */
import { useRef, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useCiteTooltips } from "~/components/wiki-os/reader/useCiteTooltips";

jest.mock("~/components/ui/popover", () => ({
  VirtualAnchorPopover: (props: { open: boolean; anchor: unknown; children: ReactNode }) =>
    props.open && props.anchor ? <div data-testid="cite-tooltip">{props.children}</div> : null,
}));
jest.mock("~/components/wiki-os/reader/useLinkTargetPreference", () => ({
  useLinkTargetPreference: () => undefined,
}));

function Harness({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tooltip = useCiteTooltips(ref);
  return (
    <>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {tooltip}
    </>
  );
}

const page = (prefix: string) =>
  `<p>Text<sup class="reference" id="${prefix}cite_ref-1"><a href="#${prefix}cite_note-1">[1]</a></sup></p>` +
  `<ol class="references"><li id="${prefix}cite_note-1"><span class="mw-cite-backlink">^</span>` +
  `<span class="reference-text">A <b>source</b>.</span></li></ol>`;

describe("citation tooltips", () => {
  it("find a sister page's prefixed note and box its HTML in", () => {
    render(<Harness html={page("sister-")} />);
    fireEvent.mouseEnter(screen.getByText("[1]"));

    const tooltip = screen.getByTestId("cite-tooltip");
    expect(tooltip.textContent).toBe("A source.");
    expect(
      tooltip.querySelector(".reference-text")?.closest(".wikios-sister-article")
    ).not.toBeNull();
  });

  it("find an IxWiki note as before, not boxed in", () => {
    render(<Harness html={page("")} />);
    fireEvent.mouseEnter(screen.getByText("[1]"));

    const tooltip = screen.getByTestId("cite-tooltip");
    expect(tooltip.textContent).toBe("A source.");
    expect(tooltip.querySelector(".wikios-sister-article")).toBeNull();
  });
});
