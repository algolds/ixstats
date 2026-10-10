import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { boardMessage } from "~/tests/helpers/realm-board-fixtures";

jest.mock("~/trpc/react", () => {
  const mutations: Record<string, jest.Mock> = {};
  return {
    mutations,
    api: {
      thinkpagesForum: {
        continueInThread: {
          useMutation: () => ({ mutateAsync: mutations.continueInThread, isPending: false }),
        },
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});
// Radix Select does not open in jsdom; a native <select> stands in for it.
jest.mock("~/components/ui/select", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<{ value?: string; onValueChange?: (v: string) => void }>({});
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (v: string) => void;
      children: React.ReactNode;
    }) => <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange } = useContext(Ctx);
      return (
        <select
          aria-label="Where it starts"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

import { ContinueDialog } from "~/components/thinkpages-forum/realm/ContinueDialog";

const { mutations } = jest.requireMock<{ mutations: Record<string, jest.Mock> }>("~/trpc/react");

const persona = boardMessage({
  id: "p7",
  authorUserId: null,
  authorPersonaId: "ps1",
  author: { name: "Aria Vell", handle: "aria", avatarUrl: null, flagUrl: null, persona: true },
});

function open(message = boardMessage()) {
  const onOpenChange = jest.fn();
  const onDone = jest.fn();
  render(<ContinueDialog message={message} open onOpenChange={onOpenChange} onDone={onDone} />);
  return { onOpenChange, onDone };
}

const send = () => screen.getByRole("button", { name: "Continue in a thread" });

beforeEach(() => {
  jest.clearAllMocks();
  mutations.continueInThread = jest.fn().mockResolvedValue({ threadId: "t9" });
});

describe("ContinueDialog", () => {
  it("needs a title of at least three characters", () => {
    open();
    expect(send()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "ab " } });
    expect(send()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "abc" } });
    expect(send()).toBeEnabled();
  });

  it("starts a player's message in the Hub, with no board to pick", async () => {
    const { onDone, onOpenChange } = open();
    expect(screen.getByText("It starts in the realm Hub.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Where it starts")).toBeNull();
    fireEvent.change(screen.getByLabelText("Thread title"), {
      target: { value: " Kilikas exercise " },
    });
    fireEvent.click(send());
    await waitFor(() =>
      expect(mutations.continueInThread).toHaveBeenCalledWith({
        postId: "p1",
        title: "Kilikas exercise",
      })
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("lets a persona's message pick between the in-character boards", async () => {
    open(persona);
    const select = screen.getByLabelText("Where it starts");
    expect(Array.from(select.querySelectorAll("option"), (o) => o.textContent)).toEqual([
      "Character Threads",
      "Current Events",
    ]);
    fireEvent.change(select, { target: { value: "current-events" } });
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Naval notice" } });
    fireEvent.click(send());
    await waitFor(() =>
      expect(mutations.continueInThread).toHaveBeenCalledWith({
        postId: "p7",
        title: "Naval notice",
        categoryKey: "current-events",
      })
    );
  });

  it("sends when Enter is pressed in the title, but not while the title is too short", async () => {
    open();
    const title = screen.getByLabelText("Thread title");
    fireEvent.change(title, { target: { value: "ab" } });
    fireEvent.submit(title.closest("form")!);
    expect(mutations.continueInThread).not.toHaveBeenCalled();
    fireEvent.change(title, { target: { value: "Topic" } });
    fireEvent.submit(title.closest("form")!);
    await waitFor(() =>
      expect(mutations.continueInThread).toHaveBeenCalledWith({ postId: "p1", title: "Topic" })
    );
  });

  it("shows the server's refusal and stays open", async () => {
    mutations.continueInThread = jest
      .fn()
      .mockRejectedValue(new Error("Unhide this message first."));
    const { onDone } = open();
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "Topic" } });
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent("Unhide this message first.");
    expect(onDone).not.toHaveBeenCalled();
  });
});
