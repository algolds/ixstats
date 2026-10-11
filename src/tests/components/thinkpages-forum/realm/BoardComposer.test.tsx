import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { boardAccess } from "~/tests/helpers/realm-board-fixtures";

const editorFocusEnd = jest.fn();
const editorInsert = jest.fn();
const editorClear = jest.fn();
// When set, the stand-in editor takes inserted text and reports it through onChange, as the real one does once it has a
// selection; `ignoredInserts` first inserts do nothing, as the real one's do without a selection.
const echo = { inserts: false, ignoredInserts: 0 };

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
            textarea.current.value += text;
            reportRef.current?.(`<p>${textarea.current.value}</p>`, textarea.current.value, "");
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
    onSubmit: jest.fn().mockResolvedValue({ reward: null }),
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
  trpc.state.personas = PERSONAS;
});

describe("BoardComposer on a phone", () => {
  it("sits in a dock above the tab bar, on the shell's own offset", () => {
    const { container } = renderComposer({ docked: true });
    const dock = container.querySelector('[data-slot="board-dock"]');
    expect(dock).toHaveClass("fixed");
    expect(dock?.className).toContain("var(--shell-tabbar-height)");
    expect(dock).toContainElement(screen.getByTestId("editor"));
    expect(dock).toContainElement(post());
  });

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
      onSubmit: jest.fn().mockResolvedValue({ reward: null }),
    };
    rerender(<BoardComposer {...props} docked />);
    expect(screen.getByTestId("editor")).toBe(editor);
    expect(editor).toHaveValue("half a message");
    expect(post()).toBeEnabled();

    rerender(<BoardComposer {...props} docked={false} />);
    expect(screen.getByTestId("editor")).toBe(editor);
    expect(editor).toHaveValue("half a message");
  });

  it("is a pane in the page and a well inside the dock", () => {
    const { container, rerender } = renderComposer();
    const composer = () => container.querySelector('[data-slot="board-composer"]')!;
    expect(composer()).toHaveAttribute("data-variant", "pane");
    rerender(
      <BoardComposer
        realmName="Eurth"
        access={boardAccess()}
        slowModeSeconds={0}
        replyTo={null}
        quote={null}
        onTyping={jest.fn()}
        onClearReply={jest.fn()}
        onQuoteInserted={jest.fn()}
        onSubmit={jest.fn()}
        docked
      />
    );
    expect(composer()).toHaveAttribute("data-variant", "well");
  });

  describe("folded in the dock", () => {
    const composer = (container: HTMLElement) =>
      container.querySelector('[data-slot="board-composer"]')!;

    it("is a one-line bar, the placeholder and Post, until it has focus or a draft", () => {
      const { container } = renderComposer({ docked: true });
      expect(composer(container)).toHaveAttribute("data-collapsed");
      const editor = screen.getByTestId("editor");
      expect(editor).toHaveAttribute("data-hide-toolbar", "true");
      expect(Number(editor.getAttribute("data-min-height"))).toBeLessThanOrEqual(24);
      expect(post()).toBeDisabled();
      // The rest of the footer is hidden, not removed: the composer's tree does not change.
      expect(screen.getByRole("button", { name: "Attach action" }).closest("div")).toHaveClass(
        "group-data-[collapsed]:hidden"
      );
    });

    it("opens, without remounting the editor, when it is focused", () => {
      const { container } = renderComposer({ docked: true });
      const editor = screen.getByTestId("editor");
      fireEvent.focus(editor);
      expect(composer(container)).not.toHaveAttribute("data-collapsed");
      expect(screen.getByTestId("editor")).toBe(editor);
      expect(editor).toHaveAttribute("data-hide-toolbar", "false");
    });

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

    it("folds again when it is empty and focus has left", async () => {
      jest.useFakeTimers();
      try {
        const { container } = renderComposer({ docked: true });
        const editor = screen.getByTestId("editor");
        fireEvent.focus(editor);
        expect(composer(container)).not.toHaveAttribute("data-collapsed");
        fireEvent.blur(editor);
        await act(async () => jest.runAllTimers());
        expect(composer(container)).toHaveAttribute("data-collapsed");
      } finally {
        jest.useRealTimers();
      }
    });

    it("stays open while it is replying, whatever has focus", () => {
      const { container } = renderComposer({
        docked: true,
        replyTo: { postId: "p1", authorName: "Kir" },
      });
      expect(composer(container)).not.toHaveAttribute("data-collapsed");
    });

    it("is never folded in the page", () => {
      const { container } = renderComposer();
      expect(composer(container)).not.toHaveAttribute("data-collapsed");
      expect(screen.getByTestId("editor")).toHaveAttribute("data-hide-toolbar", "false");
    });
  });

  it("keeps the editor short so the dock leaves the messages in view", () => {
    renderComposer({ docked: true });
    expect(
      Number(screen.getByTestId("editor").getAttribute("data-max-height"))
    ).toBeLessThanOrEqual(120);
  });

  it("is in the page when not docked", () => {
    const { container } = renderComposer();
    expect(container.querySelector('[data-slot="board-dock"]')).toBeNull();
    expect(Number(screen.getByTestId("editor").getAttribute("data-max-height"))).toBeGreaterThan(
      120
    );
  });

  it("does not dock the reason a viewer cannot post", () => {
    const { container } = renderComposer({
      docked: true,
      access: boardAccess({ canPost: false, reason: "visitors_off", notice: "Visitors are off." }),
    });
    expect(screen.getByText("Visitors are off.")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="board-dock"]')).toBeNull();
  });

  it("still posts from the dock", async () => {
    const { onSubmit } = renderComposer({ docked: true });
    type("Hello");
    await act(async () => fireEvent.click(post()));
    expect(onSubmit).toHaveBeenCalled();
  });
});

describe("BoardComposer @ menu", () => {
  it("gives the editor the forum's @ menu source", () => {
    renderComposer();
    expect(screen.getByTestId("editor")).toHaveAttribute("data-mention-source", "true");
  });
});

describe("BoardComposer", () => {
  it("counts the plain text against the 1,000 limit", () => {
    renderComposer();
    expect(screen.getByText("0 / 1,000")).toBeInTheDocument();
    type("hello");
    expect(screen.getByText("5 / 1,000")).toBeInTheDocument();
  });

  it("refuses more than 1,000 characters and says where longer posts go", () => {
    renderComposer();
    type("a".repeat(1000));
    expect(post()).toBeEnabled();
    type("a".repeat(1001));
    expect(post()).toBeDisabled();
    expect(screen.getByText("1,001 / 1,000")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Board messages are at most 1,000 characters. Continue in a thread for longer posts."
      )
    ).toBeInTheDocument();
  });

  it("keeps Post off while empty, then posts the html and clears", async () => {
    const { onSubmit } = renderComposer();
    expect(post()).toBeDisabled();
    type("hello");
    await act(async () => {
      fireEvent.click(post());
    });
    expect(onSubmit).toHaveBeenCalledWith({
      html: "<p>hello</p>",
      personaId: null,
      replyToPostId: null,
    });
    expect(editorClear).toHaveBeenCalled();
    expect(screen.getByText("0 / 1,000")).toBeInTheDocument();
    expect(post()).toBeDisabled();
  });

  it("puts the caret back in the editor after a post, once it is writable again", async () => {
    let finish: () => void = () => undefined;
    const onSubmit = jest.fn(
      () =>
        new Promise<{ reward: null }>((resolve) => {
          finish = () => resolve({ reward: null });
        })
    );
    renderComposer({ onSubmit });
    type("hello");
    fireEvent.click(post());
    expect(screen.getByTestId("editor")).toBeDisabled();
    editorFocusEnd.mockClear();
    await act(async () => {
      finish();
    });
    expect(screen.getByTestId("editor")).toBeEnabled();
    expect(editorFocusEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("editor")).toHaveFocus();
  });

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

  it("inserts an action token from the picker", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Attach action" }));
    expect(editorInsert).toHaveBeenCalledWith("[ixaction=a1]");
  });

  it("offers Posting as when the member has personas, and posts with the chosen one", async () => {
    const { onSubmit, onTyping } = renderComposer();
    // Said as the Home composer says it, with a Switch link.
    expect(screen.getByText("Posting as")).toBeInTheDocument();
    expect(screen.getByText("yourself")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Aria (@aria)" }));
    expect(screen.getByText("@aria")).toBeInTheDocument();
    type("in character");
    expect(onTyping).toHaveBeenLastCalledWith("ps1");
    await act(async () => {
      fireEvent.click(post());
    });
    expect(onSubmit).toHaveBeenCalledWith({
      html: "<p>in character</p>",
      personaId: "ps1",
      replyToPostId: null,
    });
  });

  it("offers no Switch to a member without personas", () => {
    trpc.state.personas = [];
    renderComposer();
    expect(screen.queryByText("Posting as")).toBeNull();
    expect(screen.queryByRole("button", { name: "Switch" })).toBeNull();
  });

  it("tells the room you are typing, as yourself by default, and not for an empty editor", () => {
    const { onTyping } = renderComposer();
    type("h");
    expect(onTyping).toHaveBeenCalledWith(null);
    onTyping.mockClear();
    type("   ");
    expect(onTyping).not.toHaveBeenCalled();
  });

  describe("reply", () => {
    it("shows who it answers, sends the reply, and clears the chip after posting", async () => {
      const { onSubmit, onClearReply } = renderComposer({
        replyTo: { postId: "p0", authorName: "kir" },
      });
      expect(screen.getByText("Replying to kir")).toBeInTheDocument();
      type("yes");
      await act(async () => {
        fireEvent.click(post());
      });
      expect(onSubmit).toHaveBeenCalledWith({
        html: "<p>yes</p>",
        personaId: null,
        replyToPostId: "p0",
      });
      expect(onClearReply).toHaveBeenCalled();
    });

    it("lets the member cancel the reply", () => {
      const { onClearReply } = renderComposer({ replyTo: { postId: "p0", authorName: "kir" } });
      fireEvent.click(screen.getByRole("button", { name: "Cancel reply" }));
      expect(onClearReply).toHaveBeenCalled();
    });

    it("focuses the editor when a reply starts", () => {
      const { rerender } = renderComposer();
      editorFocusEnd.mockClear();
      rerender(
        <BoardComposer
          realmName="Eurth"
          access={boardAccess()}
          slowModeSeconds={0}
          replyTo={{ postId: "p0", authorName: "kir" }}
          quote={null}
          onSubmit={jest.fn()}
          onTyping={jest.fn()}
          onClearReply={jest.fn()}
          onQuoteInserted={jest.fn()}
        />
      );
      expect(editorFocusEnd).toHaveBeenCalled();
    });
  });

  describe("quote", () => {
    it("puts the quote into the editor once per request", () => {
      const { rerender, onQuoteInserted } = renderComposer({
        quote: { key: 1, text: 'kir wrote: "Anyone up for exercises?" ' },
      });
      expect(editorInsert).toHaveBeenCalledWith('kir wrote: "Anyone up for exercises?" ');
      expect(onQuoteInserted).toHaveBeenCalledTimes(1);
      rerender(
        <BoardComposer
          realmName="Eurth"
          access={boardAccess()}
          slowModeSeconds={0}
          replyTo={null}
          quote={{ key: 1, text: 'kir wrote: "Anyone up for exercises?" ' }}
          onSubmit={jest.fn()}
          onTyping={jest.fn()}
          onClearReply={jest.fn()}
          onQuoteInserted={onQuoteInserted}
        />
      );
      expect(editorInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("slow mode", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("counts down from the realm's slow mode after your own post", async () => {
      renderComposer({ slowModeSeconds: 10 });
      type("hello");
      await act(async () => {
        fireEvent.click(post());
      });
      expect(screen.getByText("You can post again in 10s")).toBeInTheDocument();
      type("again");
      expect(post()).toBeDisabled();
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(screen.getByText("You can post again in 6s")).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(6000);
      });
      expect(screen.queryByText(/You can post again/)).toBeNull();
      expect(post()).toBeEnabled();
    });

    it("counts down from the wait the server reports when it refuses a post", async () => {
      const refusal = Object.assign(new Error("You can post again in 23s"), {
        data: { code: "TOO_MANY_REQUESTS", context: { retryAfterSeconds: 23 } },
      });
      const onSubmit = jest.fn().mockRejectedValue(refusal);
      renderComposer({ slowModeSeconds: 30, onSubmit });
      type("hello");
      await act(async () => {
        fireEvent.click(post());
      });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByText("You can post again in 23s")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(post()).toBeDisabled();
    });

    it("does not slow a moderator", async () => {
      renderComposer({ slowModeSeconds: 10, access: boardAccess({ isModerator: true }) });
      type("hello");
      await act(async () => {
        fireEvent.click(post());
      });
      expect(screen.queryByText(/You can post again/)).toBeNull();
    });
  });

  describe("when the viewer cannot post", () => {
    it("asks a signed-out reader to sign in, with no composer", () => {
      renderComposer({
        access: boardAccess({
          canPost: false,
          isMember: false,
          reason: "sign_in",
          notice: "Sign in to post on the Eurth board.",
        }),
      });
      expect(screen.queryByTestId("editor")).toBeNull();
      expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByText(/to post on the Eurth board/)).toBeInTheDocument();
    });

    it.each([
      ["visitors_off", "Eurth does not allow visitors to post on its board."],
      ["archived", "Eurth is archived. Its board is read-only."],
    ] as const)("shows the %s reason in place of the composer", (reason, notice) => {
      renderComposer({
        access: boardAccess({ canPost: false, isMember: false, isVisitor: true, reason, notice }),
      });
      expect(screen.queryByTestId("editor")).toBeNull();
      expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
      expect(screen.getByText(notice)).toBeInTheDocument();
    });

    it("shows a ban with the way to appeal it", () => {
      renderComposer({
        access: boardAccess({
          canPost: false,
          reason: "banned",
          notice: "You are banned from the Eurth board.",
        }),
      });
      expect(screen.getByText("You are banned from the Eurth board.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Appeal" })).toBeInTheDocument();
      expect(screen.queryByTestId("editor")).toBeNull();
    });
  });
});

describe("BoardComposer rewards and prefill", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("shows what the message earned and clears it when the next message is typed", async () => {
    renderComposer({ onSubmit: jest.fn().mockResolvedValue({ reward: { amount: 5 } }) });
    type("We act");
    fireEvent.click(post());
    expect(await screen.findByText("+5 IxC for posting your action")).toBeInTheDocument();
    type("More");
    expect(screen.queryByText("+5 IxC for posting your action")).toBeNull();
  });

  it("keeps the reward line when the editor clears itself after the post", async () => {
    renderComposer({ onSubmit: jest.fn().mockResolvedValue({ reward: { amount: 5 } }) });
    type("We act");
    fireEvent.click(post());
    await screen.findByText("+5 IxC for posting your action");
    type("");
    expect(screen.getByText("+5 IxC for posting your action")).toBeInTheDocument();
  });

  it("shows no reward line for a message that earned nothing", async () => {
    const { onSubmit } = renderComposer();
    type("Hello");
    fireEvent.click(post());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByText(/IxC for posting/)).toBeNull();
  });

  it("never shows a reward beside a refusal", async () => {
    const onSubmit = jest
      .fn()
      .mockResolvedValueOnce({ reward: { amount: 5 } })
      .mockRejectedValueOnce(new Error("Nope"));
    renderComposer({ onSubmit });
    type("We act");
    fireEvent.click(post());
    await screen.findByText("+5 IxC for posting your action");
    type("again");
    fireEvent.click(post());
    expect(await screen.findByText("Nope")).toBeInTheDocument();
    expect(screen.queryByText(/IxC for posting/)).toBeNull();
  });

  it("inserts the attached action into the editor once and removes the parameter", async () => {
    echo.inserts = true;
    window.history.replaceState(null, "", "/thinkpages/r/eurth?attach=dir-abc&x=1");
    renderComposer();
    await waitFor(() => expect(screen.getByTestId("editor")).toHaveValue("[ixaction=dir-abc]"));
    await waitFor(() => expect(window.location.search).toBe("?x=1"));
    expect(editorInsert).toHaveBeenCalledTimes(1);
    expect(editorInsert).toHaveBeenCalledWith("[ixaction=dir-abc]");
  });

  it("tries again when the first insert does nothing, and counts the token only once it shows in the text", async () => {
    echo.inserts = true;
    echo.ignoredInserts = 1;
    window.history.replaceState(null, "", "/thinkpages/r/eurth?attach=dir-abc");
    renderComposer();
    await waitFor(() => expect(screen.getByTestId("editor")).toHaveValue("[ixaction=dir-abc]"));
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(editorInsert).toHaveBeenCalledTimes(2);
  });

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

  it("leaves the editor alone without the parameter", async () => {
    echo.inserts = true;
    renderComposer();
    await act(async () => undefined);
    expect(editorInsert).not.toHaveBeenCalled();
  });
});
