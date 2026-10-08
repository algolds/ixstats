/**
 * The article views and page tools row scrolls with the page. Pinned under the Halo band it floated
 * over the article text (content showed above and through it), so it is a plain in-flow row.
 */
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ usePathname: () => "/wiki/Aurelia" }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { WikiOSContentWrapper } from "~/components/wiki-os/shared/WikiOSContentWrapper";

const tabs = <div role="tablist">tabs</div>;
const rowOf = (el: HTMLElement) => el.closest("[data-slot='wiki-article-tools']") as HTMLElement;

describe("WikiOS article tools row", () => {
  it.each([
    ["with a page header", "Aurelia"],
    ["without one", undefined],
  ])("is not sticky and never floats over the article %s", (_label, title) => {
    render(
      <WikiOSContentWrapper title={title} tabs={tabs} actions={<button>New page</button>}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    const row = rowOf(screen.getByRole("tablist"));
    expect(row).not.toHaveClass("sticky");
    expect(row.className).not.toMatch(/\bz-/);
    expect(row.querySelector(".facet-chrome")).toBeNull();
  });

  it("keeps page tools on the row when there is no page header", () => {
    render(
      <WikiOSContentWrapper tabs={tabs} actions={<button>New page</button>}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    const row = rowOf(screen.getByRole("tablist"));
    expect(row).toContainElement(screen.getByRole("button", { name: "New page" }));
  });

  it("renders no tools row without tabs", () => {
    const { container } = render(
      <WikiOSContentWrapper title="Aurelia">
        <p>body</p>
      </WikiOSContentWrapper>
    );
    expect(container.querySelector("[data-slot='wiki-article-tools']")).toBeNull();
  });
});
