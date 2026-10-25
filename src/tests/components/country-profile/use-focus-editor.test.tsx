/**
 * The lore writer moves focus into WikiOS's editor when it opens. The editor loads its page first, so focus waits for
 * the editable surface, takes it once, never pulls focus from an editable the author is already in, and stops waiting
 * after ten seconds.
 */
import React, { useRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useFocusEditor } from "~/hooks/lore/useFocusEditor";

function Frame({ openKey = "Venceia" }: { openKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [two, setTwo] = useState(false);
  useFocusEditor(ref, openKey);
  return (
    <div>
      <button onClick={() => setLoaded(true)}>load</button>
      <button onClick={() => setTwo(true)}>second</button>
      <div ref={ref}>
        {loaded && (
          <div
            contentEditable="true"
            suppressContentEditableWarning
            tabIndex={-1}
            data-testid="canvas"
          />
        )}
        {two && <textarea data-testid="other" />}
      </div>
    </div>
  );
}

afterEach(() => jest.useRealTimers());

describe("useFocusEditor", () => {
  it("waits for the editor to appear, then focuses it", async () => {
    render(<Frame />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    await act(async () => {});
    expect(screen.getByTestId("canvas")).toHaveFocus();
  });

  it("focuses once: after the author moves on, a later change never pulls focus back", async () => {
    render(<Frame />);
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    await act(async () => {});
    screen.getByRole("button", { name: "second" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "second" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "second" })).toHaveFocus();
  });

  it("takes focus from a control in the frame that is not an editor", async () => {
    function WithControl() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusEditor(ref, "Venceia");
      return (
        <div ref={ref}>
          <button autoFocus>Start from the form instead</button>
          <div
            contentEditable="true"
            suppressContentEditableWarning
            tabIndex={-1}
            data-testid="canvas"
          />
        </div>
      );
    }
    render(<WithControl />);
    expect(screen.getByTestId("canvas")).toHaveFocus();
  });

  it("leaves focus where it is when it is already in an editable in the frame", async () => {
    function Ready() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusEditor(ref, "Venceia");
      return (
        <div ref={ref}>
          <div
            contentEditable="true"
            suppressContentEditableWarning
            tabIndex={-1}
            data-testid="canvas-first"
          />
          <textarea data-testid="first" autoFocus />
          <div
            contentEditable="true"
            suppressContentEditableWarning
            tabIndex={-1}
            data-testid="canvas"
          />
        </div>
      );
    }
    render(<Ready />);
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("takes focus from an editable outside the frame", async () => {
    render(
      <>
        <textarea data-testid="outside" autoFocus />
        <Frame />
      </>
    );
    expect(screen.getByTestId("outside")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    await act(async () => {});
    expect(screen.getByTestId("canvas")).toHaveFocus();
  });

  it("does nothing without an open editor", async () => {
    render(<Frame openKey="" />);
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    await act(async () => {});
    expect(screen.getByTestId("canvas")).not.toHaveFocus();
  });

  it("stops waiting after ten seconds", async () => {
    jest.useFakeTimers();
    render(<Frame />);
    act(() => jest.advanceTimersByTime(10_000));
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    await act(async () => {});
    expect(screen.getByTestId("canvas")).not.toHaveFocus();
  });
});
