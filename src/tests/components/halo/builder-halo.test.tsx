/**
 * The builder Halo plugin (spec §9): founding and the editor register one command, "Jump to
 * section", and nothing else (no step list, saves or restart).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { JumpToSectionView } from "~/components/halo/plugins/builder";
const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "government", label: "Government" },
];
describe("JumpToSectionView", () => {
  it("lists the sections, marks the current one and jumps on tap", () => {
    const onJump = jest.fn();
    const onClose = jest.fn();
    render(
      <JumpToSectionView
        onClose={onClose}
        context={{ sections: SECTIONS, currentId: "government", onJump }}
      />
    );
    expect(screen.getByRole("heading", { name: "Jump to section" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Government" }).getAttribute("aria-current")).toBe(
      "step"
    );
    fireEvent.click(screen.getByRole("button", { name: "Identity" }));
    expect(onClose).toHaveBeenCalled();
    expect(onJump).toHaveBeenCalledWith("identity");
  });
});
