import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SwipeableRow, SwipeActionButton } from "~/components/ui/facet/swipeable/SwipeableRow";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";

function Icon({ className }: { className?: string }) {
  return <svg className={className} />;
}

/**
 * jsdom has no key → click default actions, so mimic the browser: Enter clicks on keydown, Space
 * on keyup — each only when nothing called `preventDefault` on the keydown.
 */
function press(el: HTMLElement, key: "Enter" | " ") {
  const notPrevented = fireEvent.keyDown(el, { key });
  if (key === "Enter") {
    if (notPrevented) fireEvent.click(el);
    return;
  }
  const upNotPrevented = fireEvent.keyUp(el, { key });
  if (notPrevented && upNotPrevented) fireEvent.click(el);
}

/** Elements in the sequential focus order (jsdom resolves default tabIndex per element). */
function tabStops(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled
  );
}

function Row({
  onOpen,
  onArchive = () => {},
  onRead = () => {},
  onCommit,
  interactive = true,
}: {
  onOpen?: () => void;
  onArchive?: () => void;
  onRead?: () => void;
  onCommit?: () => void;
  interactive?: boolean;
}) {
  return (
    <SwipeableRow>
      <SwipeableRow.Leading>
        <SwipeActionButton id="read" icon={Icon} label="Read" onClick={onRead} color="blue" />
      </SwipeableRow.Leading>
      <SwipeableRow.Trailing commit={onCommit ? { label: "Delete", action: onCommit } : undefined}>
        <SwipeActionButton
          id="archive"
          icon={Icon}
          label="Archive"
          aria-label="Archive message"
          onClick={onArchive}
          color="green"
        />
      </SwipeableRow.Trailing>
      <SwipeableRow.Content>
        {interactive ? (
          <button type="button" onClick={onOpen}>
            Open message
          </button>
        ) : (
          <div>Static message</div>
        )}
      </SwipeableRow.Content>
    </SwipeableRow>
  );
}

describe("SwipeableRow keyboard model", () => {
  it("lets Enter and Space activate a focusable child", () => {
    const onOpen = jest.fn();
    render(<Row onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: "Open message" });

    press(button, "Enter");
    expect(onOpen).toHaveBeenCalledTimes(1);
    press(button, " ");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("adds no tab stop of its own around a focusable child, and keeps tray buttons out of the tab order", () => {
    const { container } = render(<Row />);
    const button = screen.getByRole("button", { name: "Open message" });
    expect(tabStops(container)).toEqual([button]);
    // The row wrapper is neither focusable nor announced as an unnamed group.
    const row = container.querySelector<HTMLElement>("[data-swipeable-row]")!;
    expect(row.hasAttribute("tabindex")).toBe(false);
    expect(row.getAttribute("role")).toBeNull();
    // Tray buttons remain in the accessibility tree (screen-reader browse mode).
    expect(screen.getByRole("button", { name: "Archive message" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
  });

  it.each([
    ["Shift+F10", { key: "F10", shiftKey: true }],
    ["the ContextMenu key", { key: "ContextMenu" }],
  ])("opens the swipe actions as a menu with %s from the focused child", async (_name, keyInit) => {
    const onArchive = jest.fn();
    render(<Row onArchive={onArchive} />);
    const button = screen.getByRole("button", { name: "Open message" });
    button.focus();

    expect(fireEvent.keyDown(button, keyInit)).toBe(false);
    const menu = screen.getByRole("menu", { name: "Actions" });
    // Same labels (and aria-label overrides) as the swipe actions, leading tray first.
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
    ).toEqual(["Read", "Archive"]);
    const archive = within(menu).getByRole("menuitem", { name: "Archive message" });

    fireEvent.click(archive);
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    // Focus goes back to where the menu was opened from.
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("lists a commit action without a matching button in the menu", () => {
    const onCommit = jest.fn();
    render(<Row onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Open message" }), {
      key: "F10",
      shiftKey: true,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("ignores Delete, Backspace and Escape bubbling from a child", () => {
    const onCommit = jest.fn();
    render(<Row onCommit={onCommit} />);
    const button = screen.getByRole("button", { name: "Open message" });
    expect(fireEvent.keyDown(button, { key: "Delete" })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "Backspace" })).toBe(true);
    expect(fireEvent.keyDown(button, { key: "Escape" })).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  describe("a row with nothing focusable inside", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("is the single tab stop; Enter opens the actions menu and Delete runs the trailing commit", () => {
      const onRead = jest.fn();
      const onCommit = jest.fn();
      const { container } = render(<Row interactive={false} onRead={onRead} onCommit={onCommit} />);
      const row = container.querySelector<HTMLElement>("[data-swipeable-row]")!;
      expect(tabStops(container)).toEqual([row]);
      expect(row).toHaveAttribute("role", "group");
      expect(row).toHaveAttribute("aria-keyshortcuts", "Shift+F10 Delete");

      row.focus();
      press(row, "Enter");
      fireEvent.click(screen.getByRole("menuitem", { name: "Read" }));
      expect(onRead).toHaveBeenCalledTimes(1);
      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(document.activeElement).toBe(row);

      fireEvent.keyDown(row, { key: "Delete" });
      act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("toggles its Expanded panel with Enter, and buttons inside the panel keep their keys", () => {
      const onPanelButton = jest.fn();
      const { container } = render(
        <SwipeableRow>
          <SwipeableRow.Content>
            <div>Static message</div>
          </SwipeableRow.Content>
          <SwipeableRow.Expanded>
            <button type="button" onClick={onPanelButton}>
              Reply
            </button>
          </SwipeableRow.Expanded>
        </SwipeableRow>
      );
      const row = container.querySelector<HTMLElement>("[data-swipeable-row]")!;
      expect(row).toHaveAttribute("aria-expanded", "false");
      press(row, "Enter");
      expect(row).toHaveAttribute("aria-expanded", "true");

      const reply = screen.getByRole("button", { name: "Reply" });
      press(reply, "Enter");
      press(reply, " ");
      expect(onPanelButton).toHaveBeenCalledTimes(2);
      expect(row).toHaveAttribute("aria-expanded", "true");
    });
  });
});

describe("FacetRow with swipe actions", () => {
  it("is one tab stop, opens on Enter, and exposes its swipe actions from the keyboard", () => {
    const onOpen = jest.fn();
    const onDone = jest.fn();
    const { container } = render(
      <FacetListSection header="Inbox">
        <FacetRow
          title="Budget review"
          onClick={onOpen}
          swipeActions={{
            trailing: [{ id: "done", icon: Icon, label: "Done", onClick: onDone, color: "green" }],
            trailingCommit: { label: "Done", action: onDone },
          }}
        />
      </FacetListSection>
    );
    const row = screen.getByRole("button", { name: /Budget review/ });
    expect(tabStops(container)).toEqual([row]);

    press(row, "Enter");
    press(row, " ");
    expect(onOpen).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: "F10", shiftKey: true });
    const items = within(screen.getByRole("menu", { name: "Actions" })).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Done"]);
    fireEvent.click(items[0]!);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
