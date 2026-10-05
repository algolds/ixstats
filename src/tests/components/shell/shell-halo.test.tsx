import React from "react";
import { render } from "@testing-library/react";
import { ShellHalo } from "~/components/shell/ShellHalo";

jest.mock("~/components/halo", () => ({ CommandPalette: () => <div>palette</div> }));

describe("ShellHalo", () => {
  it("centres over the content column: clear of the sidebar and of the Inspector gutter", () => {
    const { container } = render(<ShellHalo />);
    const halo = container.querySelector("[data-slot='shell-halo']")!;
    expect(halo).toHaveClass("left-(--shell-sidebar-width)", "right-(--shell-inspector-width)");
    expect(halo).not.toHaveClass("right-0");
  });
});
