/**
 * The composer's tool buttons (chart, image, GIF, poll) sit in a bar shown only while the editor
 * has focus. A mousedown on them must not blur the editor, or the bar collapses
 * (pointer-events-none) before the click lands and the button does nothing.
 */
import React from "react";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { ComposerActionBar } from "~/components/thinkpages/composer/ComposerActionBar";
import { TooltipProvider } from "~/components/ui/tooltip";

jest.mock("~/components/thinkpages/GifPicker", () => ({
  GifPicker: React.forwardRef<HTMLButtonElement>(function GifPicker(_props, ref) {
    return <button ref={ref} type="button" aria-label="Insert GIF" />;
  }),
}));

function setup(over: Partial<React.ComponentProps<typeof ComposerActionBar>> = {}) {
  const props = {
    showActionBar: true,
    remainingChars: 280,
    showVisualizationPanel: false,
    setShowVisualizationPanel: jest.fn(),
    isGeneratingVisualization: false,
    setShowMediaModal: jest.fn(),
    selectedImages: [],
    handleInsertGif: jest.fn(),
    pollDraft: null,
    setPollDraft: jest.fn(),
    setShowPollModal: jest.fn(),
    showContentWarning: false,
    setShowContentWarning: jest.fn(),
    postToDiscord: true,
    setPostToDiscord: jest.fn(),
    handleSubmit: jest.fn(),
    isPending: false,
    plainText: "",
    selectedVisualizations: [],
    ...over,
  };
  render(
    <TooltipProvider>
      <ComposerActionBar {...props} />
    </TooltipProvider>
  );
  return props;
}

describe("ComposerActionBar", () => {
  it.each([
    "Add live data chart",
    "Add media or images",
    "Insert GIF",
    "Add poll",
    "Content warning",
  ])("keeps editor focus on mousedown of %s", (label) => {
    setup();
    const button = screen.getByRole("button", { name: label });
    const down = createEvent.mouseDown(button);
    fireEvent(button, down);
    expect(down.defaultPrevented).toBe(true);
  });

  it("wires the chart, image and poll buttons", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add live data chart" }));
    fireEvent.click(screen.getByRole("button", { name: "Add media or images" }));
    fireEvent.click(screen.getByRole("button", { name: "Add poll" }));
    expect(props.setShowVisualizationPanel).toHaveBeenCalledWith(true);
    expect(props.setShowMediaModal).toHaveBeenCalledWith(true);
    expect(props.setPollDraft).toHaveBeenCalled();
    expect(props.setShowPollModal).toHaveBeenCalledWith(true);
  });

  it("toggles the content warning field", () => {
    const props = setup();
    const toggle = screen.getByRole("button", { name: "Content warning" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(props.setShowContentWarning).toHaveBeenCalledWith(true);
  });

  it("lets a poll-only post be shared", () => {
    setup({
      pollDraft: { question: "Q", pollType: "choice", multiple: false, options: ["a", "b"] },
    });
    expect(screen.getByRole("button", { name: /Share$/ })).toBeEnabled();
  });
});
