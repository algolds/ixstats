/**
 * useArticleEditMode: the article page's read/edit mode and its address (`?action=edit`). Leaving the editor (Cancel,
 * or a save) pushes the reading address, but the router's search params catch up a render later: the page used to see
 * "reading, yet the address says edit" and reopened the editor on the page's text, so a save never returned to the
 * article and Cancel left the editor up with the author's text replaced. The address opens the editor only when it
 * turns to `?action=edit` (back/forward), never while it lags behind a mode the page just left.
 */
import { act, renderHook } from "@testing-library/react";
import { useArticleEditMode } from "~/components/wiki-os/editor/hooks/useArticleEditMode";

const setup = (editInAddress: boolean, initialMode: "reading" | "source" | "visual") =>
  renderHook(({ edit }) => useArticleEditMode(edit, initialMode), {
    initialProps: { edit: editInAddress },
  });

describe("useArticleEditMode", () => {
  it("opens on the mode it is given", () => {
    expect(setup(true, "visual").result.current[0]).toBe("visual");
  });

  it("leaving the editor stays left while the address still says ?action=edit", () => {
    const { result, rerender } = setup(true, "source");
    act(() => result.current[1]("reading"));
    rerender({ edit: true });
    expect(result.current[0]).toBe("reading");
    rerender({ edit: false });
    expect(result.current[0]).toBe("reading");
  });

  it("an address that turns to ?action=edit (back or forward) opens the source editor", () => {
    const { result, rerender } = setup(false, "reading");
    rerender({ edit: true });
    expect(result.current[0]).toBe("source");
  });

  it("the address turning to edit leaves an open editor's mode alone", () => {
    const { result, rerender } = setup(false, "reading");
    act(() => result.current[1]("visual"));
    rerender({ edit: true });
    expect(result.current[0]).toBe("visual");
  });
});
