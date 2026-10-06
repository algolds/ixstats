import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PlateRawWikitextElement } from "~/components/wiki-os/editor/plate/elements/PlateRawWikitextElement";

const mockRemoveNodes = jest.fn();
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();
let mockElement: Record<string, unknown> = {};
let mockReadOnly = false;

jest.mock("slate", () => ({ Transforms: { removeNodes: (...args: unknown[]) => mockRemoveNodes(...args) } }));
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

  it("shows the source so that it can be selected: no select-none on it or on its container", () => {
    renderBlock();
    const source = screen.getByLabelText("Source of the <pre> block");
    expect(source.textContent).toBe(SOURCE);
    expect(source.className).toContain("select-text");
    expect(source.className).not.toContain("select-none");
    expect(source.closest("[role='group']")!.className).not.toContain("select-none");
    expect(source.tabIndex).toBe(0);
  });

  it("names the block for assistive technology and gives the full description on hover and focus", () => {
    renderBlock();
    const group = screen.getByRole("group", { name: "<pre> block, read-only source" });
    expect(group.tabIndex).toBe(0);
    expect(group.getAttribute("title")).toContain("saved exactly as written");
    const description = within(group).getByText(/block whose content is literal text/);
    // cut to one line at rest, in full when the block is hovered or has keyboard focus
    expect(description.className).toContain("truncate");
    expect(description.className).toContain("group-hover:whitespace-normal");
    expect(description.className).toContain("group-focus-within:whitespace-normal");
    expect(description.textContent).toContain("edit it in the source editor");
  });

  it("labels its buttons", () => {
    renderBlock();
    expect(screen.getByRole("button", { name: "Copy the source of this <pre> block" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove this <pre> block" })).toBeTruthy();
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
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }));

    expect(mockRemoveNodes).toHaveBeenCalledTimes(1);
    expect(mockRemoveNodes.mock.calls[0]![1]).toEqual({ at: [3] });
  });

  it("offers no removal in a read-only editor, but still the copy", () => {
    mockReadOnly = true;
    renderBlock();
    expect(screen.queryByRole("button", { name: /Remove this/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Copy the source/ })).toBeTruthy();
  });

  it.each([
    [{ construct: "redirect" }, "Redirect", /redirects to another page/],
    [{ construct: "comment" }, "Comment", /HTML comment/],
    [{ construct: "magic-word" }, "Magic word", /__MAGIC_WORD__/],
    [{ construct: "nested-table" }, "Nested table", /table inside a table cell/],
    [{ construct: "table-template" }, "Table", /template on its own line/],
    [{ construct: "malformed" }, "Source", /unclosed or malformed/],
  ])("describes %j as %s", (element, label, description) => {
    mockElement = { type: "raw-wikitext", rawWikitext: "x", ...element };
    renderBlock();
    expect(screen.getByRole("group", { name: `${label} block, read-only source` })).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
  });
});
