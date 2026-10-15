/**
 * The builder Halo plugin (spec §9): founding and the editor register one command, "Jump to
 * section", and nothing else (no step list, saves or restart).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { BuilderHalo, JumpToSectionView } from "~/components/halo/plugins/builder";
import { DIPluginProvider, useActiveDIPlugin } from "~/components/halo/plugin-context";
import type { DIPlugin } from "~/components/halo/types";

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "government", label: "Government" },
];

describe("BuilderHalo", () => {
  it("registers a jump-to-section view and no actions", () => {
    let active: DIPlugin | null = null;
    function Probe() {
      active = useActiveDIPlugin();
      return null;
    }
    render(
      <DIPluginProvider>
        <BuilderHalo label="Found a nation" sections={SECTIONS} onJump={() => {}} />
        <Probe />
      </DIPluginProvider>
    );
    const plugin = active as DIPlugin | null;
    expect(plugin?.id).toBe("builder");
    expect(Object.keys(plugin?.expandedViews ?? {})).toEqual(["sections"]);
    expect(plugin?.actions).toBeUndefined();
  });
});

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
