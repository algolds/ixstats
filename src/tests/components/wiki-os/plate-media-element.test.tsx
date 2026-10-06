import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { PlateMediaElement } from "~/components/wiki-os/editor/plate/elements/PlateMediaElement";
import {
  PlateWikiCallbacksProvider,
  useOptionalPlateWikiCallbacks,
  usePlateWikiCallbacks,
} from "~/components/wiki-os/editor/plate/elements/PlateRawHtmlElement";

const mockRemoveNodes = jest.fn();
let mockElement: Record<string, unknown> = {};

jest.mock("slate", () => ({ Transforms: { removeNodes: (...args: unknown[]) => mockRemoveNodes(...args) } }));
jest.mock("platejs/react", () => ({
  useElement: () => mockElement,
  usePath: () => [4],
  useReadOnly: () => false,
  useEditorRef: () => ({}),
}));
jest.mock("~/lib/wiki-os/transformers/image-url", () => ({ resolveImageUrl: (name: string) => (name ? `/img/${name}` : "") }));

const renderMedia = () =>
  render(
    <PlateMediaElement attributes={{ "data-slate-node": "element" }}>
      <span>slate children</span>
    </PlateMediaElement>
  );

describe("PlateMediaElement callbacks (F3: the hook is always called, never in a try block)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElement = { type: "media", id: "node-1", filename: "Map.png" };
  });

  it("removes the node through the editor when it is rendered outside the callbacks provider", () => {
    renderMedia();
    fireEvent.click(screen.getByText("Remove"));
    expect(mockRemoveNodes).toHaveBeenCalledWith({}, { at: [4] });
  });

  it("deletes the node through the provider's callback when there is one", () => {
    const deleteNode = jest.fn();
    render(
      <PlateWikiCallbacksProvider value={{ openTemplateEditor: jest.fn(), deleteNode }}>
        <PlateMediaElement attributes={{ "data-slate-node": "element" }}>
          <span>slate children</span>
        </PlateMediaElement>
      </PlateWikiCallbacksProvider>
    );
    fireEvent.click(screen.getByText("Remove"));
    expect(deleteNode).toHaveBeenCalledWith("node-1");
    expect(mockRemoveNodes).not.toHaveBeenCalled();
  });

  it("keeps the throwing hook for elements that need the provider, and the optional one answers null", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(renderHook(() => useOptionalPlateWikiCallbacks()).result.current).toBeNull();
    expect(() => renderHook(() => usePlateWikiCallbacks())).toThrow("PlateWikiCallbacks missing from tree");
  });
});
