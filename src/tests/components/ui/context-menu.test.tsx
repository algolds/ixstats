import "react";
import { createPortal } from "react-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "~/components/ui/context-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";

beforeAll(() => {
  // jsdom has no PointerEvent: without one, fireEvent's pointer events carry no button or pointerType
  class TestPointerEvent extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "";
    }
  }
  globalThis.PointerEvent ??= TestPointerEvent as typeof PointerEvent;
});

/** The items fragment a "More actions" dropdown would render too. */
function PostItems({ onEdit }: { onEdit: () => void }) {
  return (
    <>
      <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
    </>
  );
}

function Post({ onEdit = () => {} }: { onEdit?: () => void }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article data-testid="post">
          Body text <a href="/elsewhere">a link</a>
          {/* A dialog the post opened: portalled, so its events bubble through the trigger in React. */}
          {createPortal(<div data-testid="dialog">Report</div>, document.body)}
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <PostItems onEdit={onEdit} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function rightClick(el: Element, init: MouseEventInit = {}) {
  fireEvent.pointerDown(el, { button: 2, ...init });
  return fireEvent.contextMenu(el, { button: 2, ...init });
}

describe("ContextMenu", () => {
  it("opens on right-click and renders the dropdown's items fragment", () => {
    const onEdit = jest.fn();
    render(<Post onEdit={onEdit} />);
    const notPrevented = rightClick(screen.getByTestId("post"));
    expect(notPrevented).toBe(false);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("leaves the browser menu to Shift+right-click", () => {
    render(<Post />);
    expect(rightClick(screen.getByTestId("post"), { shiftKey: true })).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves the browser menu to links inside the trigger", () => {
    render(<Post />);
    expect(rightClick(screen.getByRole("link"))).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("leaves the browser menu to portals the trigger renders, by mouse or keyboard", () => {
    render(<Post />);
    const dialog = screen.getByTestId("dialog");
    expect(rightClick(dialog)).toBe(true);
    fireEvent.keyDown(dialog, { key: "F10", shiftKey: true });
    expect(fireEvent.contextMenu(dialog)).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  describe("long-press on touch", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const longPress = (el: Element) => {
      fireEvent.pointerDown(el, { pointerType: "touch", button: 0 });
      act(() => jest.advanceTimersByTime(800));
    };

    it("opens the menu on the thing", () => {
      render(<Post />);
      longPress(screen.getByTestId("post"));
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("leaves dialogs the thing opened, and links inside it, to the browser", () => {
      render(<Post />);
      longPress(screen.getByTestId("dialog"));
      expect(screen.queryByRole("menu")).toBeNull();
      longPress(screen.getByRole("link"));
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  it("leaves the browser menu to a selection inside the trigger", () => {
    render(<Post />);
    const post = screen.getByTestId("post");
    window.getSelection()?.selectAllChildren(post);
    expect(rightClick(post)).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
    window.getSelection()?.removeAllRanges();
  });

  it("opens again for a plain right-click after a passthrough", () => {
    render(<Post />);
    const post = screen.getByTestId("post");
    rightClick(post, { shiftKey: true });
    rightClick(post);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
