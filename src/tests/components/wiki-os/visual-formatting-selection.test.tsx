/**
 * The canvas toolbar's active formats follow Slate's own selection, never the DOM `selectionchange` event. Slate
 * reads a click's new DOM selection a tick later (slate-react debounces its listener); a toolbar state change rendered
 * from the event itself re-rendered the editor first, and Slate put the DOM caret back where its stale selection was.
 * So a click into a list item, a table cell or bold text (anything whose formats differ) never moved the caret.
 */
import { act, renderHook } from "@testing-library/react";
import { useWikiVisualFormatting } from "~/components/wiki-os/editor/hooks/useWikiVisualFormatting";

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: { previewWikitext: { useMutation: () => ({ mutateAsync: jest.fn() }) } },
    useUtils: () => ({}),
  },
}));
jest.mock("platejs", () => ({ nanoid: () => "id" }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));

function canvasWithList(): Text {
  document.body.innerHTML =
    '<div class="wikios-ve-content" contenteditable="true"><p>para</p><ul><li><span>item</span></li></ul></div>';
  return document.querySelector("li span")!.firstChild as Text;
}

function placeCaret(node: Text): void {
  const range = document.createRange();
  range.setStart(node, 1);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

const setup = () =>
  renderHook(() =>
    useWikiVisualFormatting({
      title: "Page",
      editorRef: { current: null },
      setIsDirty: jest.fn(),
    })
  );

describe("useWikiVisualFormatting and the DOM selection", () => {
  it("a DOM selectionchange alone does not re-render the canvas (Slate has not read the new caret yet)", () => {
    const item = canvasWithList();
    const { result } = setup();
    const before = result.current.activeFormats;
    act(() => {
      placeCaret(item);
      document.dispatchEvent(new Event("selectionchange"));
    });
    expect(result.current.activeFormats).toBe(before);
  });

  it("refreshActiveFormats (called on Slate's selection operations) picks the list format up", () => {
    const item = canvasWithList();
    const { result } = setup();
    act(() => {
      placeCaret(item);
      result.current.refreshActiveFormats();
    });
    expect(result.current.activeFormats.has("ul")).toBe(true);
  });
});
