import "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PlateRawWikitextElement } from "~/components/wiki-os/editor/plate/elements/PlateRawWikitextElement";

const mockRemoveNodes = jest.fn();
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();
let mockElement: Record<string, unknown> = {};
let mockReadOnly = false;

jest.mock("slate", () => ({
  Transforms: { removeNodes: (...args: unknown[]) => mockRemoveNodes(...args) },
}));
jest.mock("platejs/react", () => ({
  useElement: () => mockElement,
  usePath: () => [3],
  useReadOnly: () => mockReadOnly,
  useEditorRef: () => ({}),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
  }),
}));

const SOURCE = "<pre>\n{{not a template}}\n</pre>";

function renderBlock() {
  return render(
    <PlateRawWikitextElement attributes={{ "data-slate-node": "element" }}>
      <span>slate children</span>
    </PlateRawWikitextElement>
  );
}

describe("PlateRawWikitextElement (review fix 11)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadOnly = false;
    mockElement = { type: "raw-wikitext", construct: "tag", tag: "pre", rawWikitext: SOURCE };
  });
  it("copies the source to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Copy the source of this <pre> block" }));
    expect(writeText).toHaveBeenCalledWith(SOURCE);
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalled());
  });

  it("asks before removing the block and removes nothing when the author keeps it", async () => {
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Remove this <pre> block" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Remove this <pre> block?")).toBeTruthy();
    expect(mockRemoveNodes).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockRemoveNodes).not.toHaveBeenCalled();
  });

  it("removes the block once the author confirms", async () => {
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Remove this <pre> block" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" })
    );

    expect(mockRemoveNodes).toHaveBeenCalledTimes(1);
    expect(mockRemoveNodes.mock.calls[0]![1]).toEqual({ at: [3] });
  });

  it("offers no removal in a read-only editor, but still the copy", () => {
    mockReadOnly = true;
    renderBlock();
    expect(screen.queryByRole("button", { name: /Remove this/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Copy the source/ })).toBeTruthy();
  });
});

describe("PlateRawWikitextElement as a forum quote", () => {
  beforeEach(() => {
    mockReadOnly = false;
    mockElement = {
      type: "raw-wikitext",
      construct: "forum-quote",
      rawWikitext: '<blockquote class="forum-quote" data-post="p1">...</blockquote>',
      label: "Heku",
      caption: "Hello there",
    };
  });

  it("shows who wrote what, never the tags the quote is saved with", () => {
    const { container } = renderBlock();
    expect(screen.getByText("Heku wrote:")).toBeTruthy();
    expect(screen.getByText(/Hello there/)).toBeTruthy();
    expect(container.textContent).not.toContain("<blockquote");
    expect(screen.getByRole("group", { name: "Quote block, read-only source" })).toBeTruthy();
    expect(container.querySelector("pre")).toBeNull();
  });
});
