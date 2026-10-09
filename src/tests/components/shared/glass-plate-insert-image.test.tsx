import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (url: string) => void;
}
let lastModalProps: ModalProps | null = null;
const insertImageUrl = jest.fn();
const mockSelect = jest.fn();
const fakeEditor = { selection: { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 1 } }, children: [] };

jest.mock("next/dynamic", () => () =>
  function MockModal(props: ModalProps) {
    lastModalProps = props;
    return <div data-testid="media-modal" />;
  }
);
jest.mock("platejs/react", () => ({
  Plate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PlateContent: () => <div data-testid="plate-content" />,
}));
jest.mock("slate", () => ({
  Transforms: { select: (...args: unknown[]) => mockSelect(...args), insertText: jest.fn() },
  Node: { string: () => "" },
}));
jest.mock("slate-react", () => ({ ReactEditor: { focus: jest.fn() } }));
jest.mock("~/components/shared/editor/SlateSerializer", () => ({
  slateNodesToHtml: () => "",
  slateNodesToBbcode: () => "",
  isMarkActive: () => false,
  toggleMark: jest.fn(),
  toggleBlock: jest.fn(),
}));
jest.mock("~/components/shared/editor/EditorToolbar", () => ({ EditorToolbar: () => null }));
jest.mock("~/components/shared/editor/MentionMenuPortal", () => ({ MentionMenuPortal: () => null }));
jest.mock("~/components/shared/editor/WikiAndStashPopovers", () => ({ WikiAndStashPopovers: () => null }));
jest.mock("~/components/shared/editor/useGlassPlateEditor", () => ({
  useGlassPlateEditor: () => ({
    editor: fakeEditor,
    insertImageUrl,
    mentionCoords: null,
    wikiSearch: { data: [], isLoading: false },
  }),
}));

import { GlassPlateEditor } from "~/components/shared/editor/GlassPlateEditor";

describe("GlassPlateEditor insert image button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastModalProps = null;
  });

  it("opens the image repository only on click and inserts the chosen url at the saved cursor", () => {
    render(<GlassPlateEditor />);
    expect(screen.queryByTestId("media-modal")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));
    expect(screen.getByTestId("media-modal")).toBeTruthy();

    act(() => lastModalProps?.onImageSelect("https://x/y.png"));

    expect(mockSelect).toHaveBeenCalledWith(fakeEditor, fakeEditor.selection);
    expect(insertImageUrl).toHaveBeenCalledWith("https://x/y.png");
    expect(screen.queryByTestId("media-modal")).toBeNull();
  });

  it("closing the modal inserts nothing", () => {
    render(<GlassPlateEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Insert image" }));
    act(() => lastModalProps?.onClose());
    expect(screen.queryByTestId("media-modal")).toBeNull();
    expect(insertImageUrl).not.toHaveBeenCalled();
  });

  it("has no Insert image button when the editor is disabled", () => {
    render(<GlassPlateEditor disabled />);
    expect(screen.queryByRole("button", { name: "Insert image" })).toBeNull();
  });
});
