/**
 * The editor's status bar while a generated world is on the map: a Draft badge, and the generator's stage in
 * place of the mode's hint while a world is being made.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";

afterEach(() => act(() => transientMapStore.setWorldDraft(null)));

describe("EditorStatusBar and the world draft", () => {
  it("shows no Draft badge when no world is on the map", () => {
    render(<EditorStatusBar mode="view" />);
    expect(screen.queryByText("Draft")).toBeNull();
    expect(screen.getByText("Click a feature to edit")).toBeInTheDocument();
  });

  it("shows the Draft badge beside the mode, with what the preview is", () => {
    transientMapStore.setWorldDraft({ message: "" });
    render(<EditorStatusBar mode="view" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Select")).toBeInTheDocument();
    expect(screen.getByText("Preview of a generated world, not saved")).toBeInTheDocument();
  });

  it("shows the stage being made while the generator works, then goes back", async () => {
    render(<EditorStatusBar mode="view" />);
    act(() => transientMapStore.setWorldDraft({ message: "Computing multi-fractal terrain" }));
    await waitFor(() =>
      expect(screen.getByText("Computing multi-fractal terrain")).toBeInTheDocument()
    );
    act(() => transientMapStore.setWorldDraft(null));
    await waitFor(() => expect(screen.queryByText("Draft")).toBeNull());
    expect(screen.getByText("Click a feature to edit")).toBeInTheDocument();
  });
});
