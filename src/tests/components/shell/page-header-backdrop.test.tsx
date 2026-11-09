import React from "react";
import { render } from "@testing-library/react";
import { PageHeader } from "~/components/shell/PageHeader";

describe("PageHeader backdrop plate", () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });

  it("puts the title on a frosted lens over visible backdrop art", () => {
    const { container } = render(<PageHeader title="Caphiria" backdrop={<div />} />);
    const plate = container.querySelector('[data-slot="page-header-plate"]');
    expect(plate).not.toBeNull();
    expect(plate).toHaveAttribute("data-layer", "lens");
    expect(plate).toHaveClass("facet-lens-frosted");
  });

  it("drops the lens when the art is missing", () => {
    const { container } = render(
      <PageHeader title="Caphiria" backdrop={<div />} backdropVisible={false} />
    );
    const plate = container.querySelector('[data-slot="page-header-plate"]');
    expect(plate).not.toBeNull();
    expect(plate).not.toHaveAttribute("data-layer");
  });
});

