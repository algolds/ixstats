/**
 * The Inspector lives in the gutter the shell reserves (shell.css), so no page lays out a
 * side-by-side flex column for it any more. Rendered, not grepped: the aside has to sit directly
 * under the page root.
 */
import fs from "fs";
import path from "path";
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));
jest.mock("~/components/sports/core/SportsFocusProvider", () => ({
  useSportsFocus: () => ({ focus: null, clearFocus: jest.fn() }),
}));
jest.mock("~/components/sports/core/SportsFocusPanel", () => ({
  SportsFocusPanel: () => null,
  sportsFocusTitle: () => "Focus",
}));

import { SportsShell } from "~/components/sports/core/SportsShell";
import { ThinktankLayout } from "~/components/thinktanks/ThinktankLayout";

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), "utf8");

describe("Inspector users do not lay out a column for it", () => {
  it("SportsShell: the aside is a direct child of the page root, beside no flex wrapper", () => {
    const { container } = render(
      <SportsShell sideContent={<p>side</p>} sideTitle="Details">
        <p>main</p>
      </SportsShell>
    );
    const root = container.firstElementChild as HTMLElement;
    const aside = screen.getByRole("complementary", { name: "Details" });
    expect(aside.parentElement).toBe(root);
    expect(root.className).not.toMatch(/\bflex\b/);
    expect(screen.getByRole("main").closest(".flex")).toBeNull();
  });

  it("ThinktankLayout: the workspace and the aside are siblings with no flex wrapper", () => {
    const { container } = render(
      <ThinktankLayout
        directoryPanel={<p>directory</p>}
        workspacePanel={<p>workspace</p>}
        directoryOpen={false}
        onDirectoryOpenChange={() => {}}
      />
    );
    const aside = screen.getByRole("complementary", { name: "ThinkTanks" });
    expect(aside.parentElement).toBe(container);
    expect(screen.getByText("workspace").closest(".flex.gap-5")).toBeNull();
  });

  it("the Inspector itself carries no inline width or sticky layout", () => {
    expect(read("src/components/ui/inspector.tsx")).not.toMatch(/\bsticky\b|\bw-80\b/);
  });

  it("fixed bars centre on the content column, not on sidebar..viewport", () => {
    for (const file of [
      "src/app/builder/components/EditorSaveBar.tsx",
      "src/app/builder/components/enhanced/steps/foundation/ArchetypeConfirmationPanel.tsx",
      "src/app/dashboard/post/[postId]/page.tsx",
    ]) {
      expect(read(file)).toContain("--shell-inspector-width");
    }
  });
});
