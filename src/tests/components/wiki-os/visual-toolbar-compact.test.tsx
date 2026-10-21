import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/wiki-os/editor/context/EditorModalContext", () => ({
  useEditorModalContext: () => ({ setShowImageSearch: jest.fn() }),
}));
jest.mock("~/components/wiki-os/editor/components/shared/StashDropdown", () => ({
  StashDropdown: () => <button type="button">Stash images</button>,
}));
jest.mock("~/components/wiki-os/editor/components/shared/TemplateDropdown", () => ({
  TemplateDropdown: () => <button type="button">Templates</button>,
}));
jest.mock("~/components/wiki-os/editor/components/shared/SettingsDropdown", () => ({
  SettingsDropdown: () => <button type="button">Editor settings</button>,
}));
jest.mock("~/components/wiki-os/editor/components/WikiEditorHeader", () => ({
  WikiEditorHeader: () => <header data-testid="page-title-bar" />,
}));
jest.mock("~/hooks/useNavigationScroll", () => ({
  useNavigationScroll: () => ({ repulsionProgress: 0 }),
}));

import { WikiVisualToolbar } from "~/components/wiki-os/editor/components/WikiVisualToolbar";

function renderToolbar(props: { compact?: boolean; hideHeader?: boolean } = {}) {
  const exec = jest.fn();
  render(
    <WikiVisualToolbar
      title="Page"
      wordCount={0}
      isDirty={false}
      onCancel={jest.fn()}
      handleSaveDraft={jest.fn()}
      activeFormats={new Set()}
      exec={exec}
      setHeading={jest.fn()}
      setParagraph={jest.fn()}
      insertLink={jest.fn()}
      removeLink={jest.fn()}
      insertHR={jest.fn()}
      insertTable={jest.fn()}
      insertRef={jest.fn()}
      clearFormatting={jest.fn()}
      handleInsertStashedImage={jest.fn()}
      {...props}
    />
  );
  return { exec };
}

describe("WikiVisualToolbar", () => {
  describe("compact", () => {
    it("opens the full toolbar behind More and folds it back", () => {
      renderToolbar({ compact: true, hideHeader: true });
      fireEvent.click(screen.getByRole("button", { name: "More" }));
      expect(screen.getByRole("button", { name: "Fewer" })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByRole("button", { name: "Insert table" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Editor settings" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Fewer" }));
      expect(screen.queryByRole("button", { name: "Insert table" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Editor settings" })).toBeNull();
    });

    it("still runs a compact control", () => {
      const { exec } = renderToolbar({ compact: true, hideHeader: true });
      fireEvent.mouseDown(screen.getByRole("button", { name: "Bold (Ctrl+B)" }));
      expect(exec).toHaveBeenCalledWith("bold");
    });
  });
});
