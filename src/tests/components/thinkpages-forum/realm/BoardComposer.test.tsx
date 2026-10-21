import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { boardAccess } from "~/tests/helpers/realm-board-fixtures";

const editorFocusEnd = jest.fn();
const editorInsert = jest.fn();
const editorClear = jest.fn();
// When set, the stand-in editor takes inserted text and reports it through onChange, as the real one does once it has a
// selection; `ignoredInserts` first inserts do nothing, as the real one's do without a selection; `defer` reports the
// change in a microtask rather than inside the call; `normalise` rewrites what the editor takes.
const echo = {
  inserts: false,
  ignoredInserts: 0,
  defer: false,
  normalise: (text: string) => text,
};

interface MockEditorProps {
  onFocus?: () => void;
  onBlur?: () => void;
  hideToolbar?: boolean;
  minHeight?: number;
  onChange?: (html: string, plain: string, bbcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxHeight?: number;
  mentionSource?: object;
  ref?: React.Ref<{ focusEnd: () => void; insertText: (t: string) => void; clear: () => void }>;
}

jest.mock(
  "next/dynamic",
  () => () =>
    function Editor({
      ref,
      onChange,
      onFocus,
      onBlur,
      hideToolbar,
      minHeight,
      placeholder,
      disabled,
      maxHeight,
      mentionSource,
    }: MockEditorProps) {
      const textarea = React.useRef<HTMLTextAreaElement>(null);
      const reportRef = React.useRef(onChange);
      reportRef.current = onChange;
      React.useImperativeHandle(
        ref,
        () => ({
          focusEnd: () => {
            editorFocusEnd();
            // A disabled field cannot take focus, as the real editor in read-only mode.
            textarea.current?.focus();
          },
          insertText: (text: string) => {
            editorInsert(text);
            if (!echo.inserts || !textarea.current) return;
            if (echo.ignoredInserts > 0) {
              echo.ignoredInserts -= 1;
              return;
            }
            const field = textarea.current;
            field.value += echo.normalise(text);
            const report = () => reportRef.current?.(`<p>${field.value}</p>`, field.value, "");
            if (echo.defer) queueMicrotask(report);
            else report();
          },
          clear: editorClear,
        }),
        []
      );
      return (
        <textarea
          ref={textarea}
          disabled={disabled}
          data-testid="editor"
          data-max-height={maxHeight}
          data-min-height={minHeight}
          data-hide-toolbar={String(hideToolbar)}
          data-mention-source={String(!!mentionSource)}
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange?.(`<p>${e.target.value}</p>`, e.target.value, "")}
        />
      );
    }
);
jest.mock("~/components/thinkpages-forum/composer/useMentionSource", () => ({
  useMentionSource: () => ({ items: [], isLoading: false, onQueryChange: jest.fn() }),
}));

jest.mock("~/components/action-links", () => ({
  ActionPicker: ({ onPick }: { onPick: (token: string) => void }) => (
    <button type="button" onClick={() => onPick("[ixaction=a1]")}>
      Attach action
    </button>
  ),
}));
jest.mock("~/trpc/react", () => {
  const state = { personas: [{ id: "ps1", displayName: "Aria", username: "aria" }] };
  return {
    state,
    api: { thinkpagesForum: { myPersonas: { useQuery: () => ({ data: state.personas }) } } },
  };
});
jest.mock("next/navigation", () => ({
  usePathname: () => "/thinkpages/r/eurth",
  useSearchParams: () => new URLSearchParams(),
}));
// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<(value: string) => void>(() => undefined);
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
      <div role="menu">{children}</div>
    ),
    DropdownMenuRadioGroup: ({
      onValueChange,
      children,
    }: {
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>,
    DropdownMenuRadioItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const choose = useContext(Ctx);
      return (
        <button type="button" role="menuitemradio" onClick={() => choose(value)}>
          {children}
        </button>
      );
    },
  };
});

const trpc = jest.requireMock<{
  state: { personas: Array<{ id: string; displayName: string; username: string }> };
}>("~/trpc/react");
const PERSONAS = [{ id: "ps1", displayName: "Aria", username: "aria" }];

import { BoardComposer } from "~/components/thinkpages-forum/realm/BoardComposer";

type Props = React.ComponentProps<typeof BoardComposer>;

function renderComposer(props: Partial<Props> = {}) {
  const handlers = {
    onSubmit: jest.fn().mockResolvedValue(undefined),
    onTyping: jest.fn(),
    onClearReply: jest.fn(),
    onQuoteInserted: jest.fn(),
  };
  const view = render(
    <BoardComposer
      realmName="Eurth"
      access={boardAccess()}
      slowModeSeconds={0}
      replyTo={null}
      quote={null}
      {...handlers}
      {...props}
    />
  );
  return { ...view, ...handlers };
}

function type(text: string) {
  fireEvent.change(screen.getByTestId("editor"), { target: { value: text } });
}

const post = () => screen.getByRole("button", { name: "Post" });

beforeEach(() => {
  jest.clearAllMocks();
  echo.inserts = false;
  echo.ignoredInserts = 0;
  echo.defer = false;
  echo.normalise = (text) => text;
  trpc.state.personas = PERSONAS;
});

describe("BoardComposer on a phone", () => {
  it("keeps the editor, and the draft in it, when the viewport crosses the phone breakpoint", () => {
    const { rerender } = renderComposer({ docked: false });
    const editor = screen.getByTestId("editor");
    type("half a message");

    const props = {
      realmName: "Eurth",
      access: boardAccess(),
      slowModeSeconds: 0,
      replyTo: null,
      quote: null,
      onTyping: jest.fn(),
      onClearReply: jest.fn(),
      onQuoteInserted: jest.fn(),
      onSubmit: jest.fn().mockResolvedValue(undefined),
    };
    rerender(<BoardComposer {...props} docked />);
    expect(screen.getByTestId("editor")).toBe(editor);
    expect(editor).toHaveValue("half a message");
    expect(post()).toBeEnabled();

    rerender(<BoardComposer {...props} docked={false} />);
    expect(screen.getByTestId("editor")).toBe(editor);
    expect(editor).toHaveValue("half a message");
  });
  describe("folded in the dock", () => {
    const composer = (container: HTMLElement) =>
      container.querySelector('[data-slot="board-composer"]')!;
    it("stays open once there is a draft, and keeps it, when focus leaves", async () => {
      jest.useFakeTimers();
      try {
        const { container } = renderComposer({ docked: true });
        const editor = screen.getByTestId("editor");
        fireEvent.focus(editor);
        type("half a message");
        fireEvent.blur(editor);
        await act(async () => jest.runAllTimers());
        expect(composer(container)).not.toHaveAttribute("data-collapsed");
        expect(screen.getByTestId("editor")).toBe(editor);
        expect(editor).toHaveValue("half a message");
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
describe("BoardComposer", () => {
  it("keeps the text and shows the error when the post fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Nope"));
    renderComposer({ onSubmit });
    type("hello");
    await act(async () => {
      fireEvent.click(post());
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Nope");
    expect(editorClear).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("BoardComposer prefill", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));
  it("does not insert again after a post", async () => {
    echo.inserts = true;
    window.history.replaceState(null, "", "/thinkpages/r/eurth?attach=dir-abc");
    const { onSubmit } = renderComposer();
    await waitFor(() => expect(window.location.search).toBe(""));
    fireEvent.click(post());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    type("");
    await act(async () => undefined);
    expect(editorInsert).toHaveBeenCalledTimes(1);
  });
  it("does not insert again when the composer remounts after the prefill succeeded", async () => {
    echo.inserts = true;
    window.history.replaceState(null, "", "/thinkpages/r/eurth?attach=dir-abc");
    const first = renderComposer();
    await waitFor(() => expect(window.location.search).toBe(""));
    first.unmount();
    renderComposer();
    await act(async () => undefined);
    expect(editorInsert).toHaveBeenCalledTimes(1);
  });
});
