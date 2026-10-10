import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ActionCardData } from "~/components/action-links";
import { boardAccess, boardMessage } from "~/tests/helpers/realm-board-fixtures";

jest.mock("~/trpc/react", () => {
  const mutations: Record<string, jest.Mock> = {};
  const mutation = (name: string) => ({
    useMutation: () => ({ mutateAsync: mutations[name], isPending: false }),
  });
  return {
    mutations,
    api: {
      useUtils: () => ({ thinkpagesForumMod: { invalidate: () => Promise.resolve() } }),
      thinkpagesForum: {
        report: mutation("report"),
        editBoardMessage: mutation("editBoardMessage"),
        continueInThread: mutation("continueInThread"),
      },
      thinkpagesForumMod: {
        context: { useQuery: () => ({ data: undefined }) },
        setPostHidden: mutation("setPostHidden"),
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { notify, useNotify: () => notify };
});
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html, className }: { html: string; className?: string }) => (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));
jest.mock("~/components/thinkpages-forum/thread/WikiEmbed", () => ({ WikiEmbeds: () => null }));
jest.mock("~/components/thinkpages/PersonaAuthorCard", () => ({
  PersonaAuthorCard: ({ children, username }: { children: React.ReactNode; username: string }) => (
    <span data-testid="persona-card" data-username={username}>
      {children}
    </span>
  ),
}));
jest.mock("~/components/thinkpages-forum/ForumComposer", () => {
  const { useState } = jest.requireActual<typeof React>("react");
  return {
    ForumComposer: ({
      initialHtml,
      submitLabel = "Post",
      onSubmit,
    }: {
      initialHtml?: string;
      submitLabel?: string;
      onSubmit: (input: { html: string; personaId: string | null }) => Promise<void>;
    }) => {
      const [error, setError] = useState<string | null>(null);
      return (
        <div>
          <p data-testid="editing">{initialHtml}</p>
          <button
            type="button"
            onClick={() =>
              void onSubmit({ html: "<p>Better</p>", personaId: null }).catch((e: Error) =>
                setError(e.message)
              )
            }
          >
            {submitLabel}
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      );
    },
  };
});
// Radix DropdownMenu opens on pointer events jsdom does not model; render its items inline.
jest.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) => (
    <button type="button" role="menuitem" onClick={() => onSelect?.(new Event("select"))}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { BoardMessage } from "~/components/thinkpages-forum/realm/BoardMessage";

const { mutations } = jest.requireMock<{ mutations: Record<string, jest.Mock> }>("~/trpc/react");
const REALM = { slug: "eurth", name: "Eurth" };

type Props = React.ComponentProps<typeof BoardMessage>;

function renderMessage(props: Partial<Props> = {}) {
  const handlers = { onReply: jest.fn(), onQuote: jest.fn(), onChanged: jest.fn() };
  const view = render(
    <BoardMessage
      message={boardMessage()}
      realm={REALM}
      access={boardAccess()}
      signedIn
      cards={new Map<string, ActionCardData>()}
      cardsReady
      cardsErrored={false}
      tools={null}
      {...handlers}
      {...props}
    />
  );
  return { ...view, ...handlers };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mutations)) delete mutations[key];
});

describe("BoardMessage header", () => {
  it("shows the author, flag, time and body, anchored for permalinks", () => {
    const { container } = renderMessage({ message: boardMessage({ id: "p9" }) });
    expect(screen.getByText("kir")).toBeInTheDocument();
    expect(container.querySelector("img[src='/flags/kir.png']")).not.toBeNull();
    expect(screen.getByText("12m")).toBeInTheDocument();
    expect(screen.getByText("Message p9")).toBeInTheDocument();
    expect(container.querySelector("article#post-p9")).not.toBeNull();
  });

  it("labels the article with its author and age", () => {
    const { container } = renderMessage();
    expect(container.querySelector("article")).toHaveAttribute(
      "aria-label",
      "Message from kir, 12m ago"
    );
  });

  it("marks an edited message", () => {
    renderMessage({ message: boardMessage({ editedAt: new Date() }) });
    expect(screen.getByText("edited")).toBeInTheDocument();
  });

  it("shows the officer and staff pill the server chose, and none for a thread starter", () => {
    const { rerender } = renderMessage({ message: boardMessage({ role: "officer" }) });
    expect(screen.getByText("Officer")).toBeInTheDocument();
    const again = (role: "staff" | "starter") =>
      rerender(
        <BoardMessage
          message={boardMessage({ role })}
          realm={REALM}
          access={boardAccess()}
          signedIn
          cards={new Map()}
          cardsReady
          cardsErrored={false}
          tools={null}
          onReply={jest.fn()}
          onQuote={jest.fn()}
          onChanged={jest.fn()}
        />
      );
    again("staff");
    expect(screen.getByText("Staff")).toBeInTheDocument();
    again("starter");
    expect(screen.queryByText("Thread starter")).toBeNull();
    expect(screen.queryByText("Staff")).toBeNull();
  });

  it("labels a visitor with their own realm, or just Visitor without one", () => {
    const { rerender } = renderMessage({
      message: boardMessage({
        isVisitor: true,
        visitorRealm: { slug: "kiro", name: "Kiro-Borea" },
      }),
    });
    expect(screen.getByText("Visitor · Kiro-Borea")).toBeInTheDocument();
    rerender(
      <BoardMessage
        message={boardMessage({ isVisitor: true })}
        realm={REALM}
        access={boardAccess()}
        signedIn
        cards={new Map()}
        cardsReady
        cardsErrored={false}
        tools={null}
        onReply={jest.fn()}
        onQuote={jest.fn()}
        onChanged={jest.fn()}
      />
    );
    expect(screen.getByText("Visitor")).toBeInTheDocument();
  });

  it("shows a persona's message as the persona only: name, handle, hover card, no flag or pills", () => {
    const { container } = renderMessage({
      message: boardMessage({
        authorUserId: null,
        authorPersonaId: "ps1",
        author: {
          name: "Aria Vell",
          handle: "aria",
          avatarUrl: null,
          flagUrl: null,
          persona: true,
        },
      }),
    });
    expect(screen.getByText("Aria Vell")).toBeInTheDocument();
    expect(screen.getByText("@aria")).toBeInTheDocument();
    expect(screen.getByTestId("persona-card")).toHaveAttribute("data-username", "aria");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText(/Officer|Staff|Visitor/)).toBeNull();
    expect(container.textContent).not.toContain("u_kir");
  });

  it("badges a hidden message for the moderators who receive it", () => {
    const { container } = renderMessage({
      message: boardMessage({ hidden: true }),
      access: boardAccess({ isModerator: true }),
    });
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(container.querySelector("article")).toHaveAttribute("data-hidden");
  });
});

describe("BoardMessage content", () => {
  it("shows the message it answers as a link to it", () => {
    renderMessage({
      message: boardMessage({
        replyTo: { postId: "p0", authorName: "fiannria", excerpt: "Who is handling the article?" },
      }),
    });
    const link = screen.getByRole("link", { name: /Replying to fiannria/ });
    expect(link).toHaveTextContent("Who is handling the article?");
    expect(link).toHaveAttribute("href", "/thinkpages/r/eurth#post-p0");
  });

  it("renders an action card for an action token", () => {
    const cards = new Map<string, ActionCardData>([
      [
        "a1",
        {
          id: "a1",
          title: "Treaty recognition",
          type: "diplomatic",
          createdAt: new Date(0),
          country: null,
        },
      ],
    ]);
    renderMessage({
      message: boardMessage({ contentHtml: "<p>Done.</p>[ixaction=a1]" }),
      cards,
    });
    expect(screen.getByLabelText("Verified action")).toBeInTheDocument();
    expect(screen.getByText("Treaty recognition")).toBeInTheDocument();
  });

  it("links a continued message to its thread, with the reply count, and offers no actions on it", () => {
    renderMessage({
      message: boardMessage({
        contentHtml: "<p>Continued in a thread</p>",
        continued: { threadId: "t7", title: "Fiannria Lore Lab", replies: 9 },
      }),
    });
    const link = screen.getByRole("link", { name: /Continued in a thread: Fiannria Lore Lab/ });
    expect(link).toHaveTextContent("9 replies");
    expect(link).toHaveAttribute("href", "/thinkpages/t/t7");
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quote" })).toBeNull();
  });

  it("says only that it continued when the viewer cannot see the thread", () => {
    renderMessage({
      message: boardMessage({
        contentHtml: "<p>Continued in a thread</p>",
        continued: { threadId: null, title: "Continued in a thread", replies: null },
      }),
    });
    expect(screen.getByText("Continued in a thread")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Continued/ })).toBeNull();
  });
});

describe("BoardMessage actions", () => {
  it("replies and quotes with the message", () => {
    const message = boardMessage();
    const { onReply, onQuote } = renderMessage({ message });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledWith(message);
    fireEvent.click(screen.getByRole("button", { name: "Quote" }));
    expect(onQuote).toHaveBeenCalledWith(message);
  });

  it("offers no Reply or Quote to a reader who cannot post", () => {
    renderMessage({
      access: boardAccess({ canPost: false, reason: "sign_in", notice: "Sign in to post." }),
      signedIn: false,
    });
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quote" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("reports another member's message", async () => {
    mutations.report = jest.fn().mockResolvedValue({});
    renderMessage();
    fireEvent.click(screen.getByRole("menuitem", { name: "Report" }));
    fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(mutations.report).toHaveBeenCalledWith({
        targetType: "post",
        targetId: "p1",
        reason: "Spam",
      })
    );
  });

  it("offers no Report on your own message", () => {
    renderMessage({ message: boardMessage({ byViewer: true }) });
    expect(screen.queryByRole("menuitem", { name: "Report" })).toBeNull();
  });

  it("edits your own message in place within the window", async () => {
    mutations.editBoardMessage = jest.fn().mockResolvedValue({});
    const { onChanged } = renderMessage({
      message: boardMessage({ byViewer: true, canEdit: true, contentHtml: "<p>Old</p>" }),
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByTestId("editing")).toHaveTextContent("<p>Old</p>");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mutations.editBoardMessage).toHaveBeenCalledWith({
        postId: "p1",
        html: "<p>Better</p>",
      })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.queryByTestId("editing")).toBeNull();
  });

  it("offers no Edit once the window has passed", () => {
    renderMessage({ message: boardMessage({ byViewer: true, canEdit: false }) });
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  });

  it("continues your own message in a thread, asking for a title", async () => {
    mutations.continueInThread = jest.fn().mockResolvedValue({ threadId: "t9" });
    const { onChanged } = renderMessage({ message: boardMessage({ byViewer: true }) });
    fireEvent.click(screen.getByRole("menuitem", { name: "Continue in a thread" }));
    fireEvent.change(await screen.findByLabelText("Thread title"), {
      target: { value: "Kilikas exercise" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue in a thread" }));
    await waitFor(() =>
      expect(mutations.continueInThread).toHaveBeenCalledWith({
        postId: "p1",
        title: "Kilikas exercise",
      })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("offers Continue in a thread to a moderator on another member's message, not to a plain member", () => {
    const { unmount } = renderMessage();
    expect(screen.queryByRole("menuitem", { name: "Continue in a thread" })).toBeNull();
    unmount();
    renderMessage({
      access: boardAccess({ isModerator: true }),
      message: boardMessage({ moderable: true, sanctionable: true }),
    });
    expect(screen.getByRole("menuitem", { name: "Continue in a thread" })).toBeInTheDocument();
  });

  it("offers no Continue to a visitor on their own message", () => {
    renderMessage({
      message: boardMessage({ byViewer: true }),
      access: boardAccess({ isVisitor: true, isMember: false }),
    });
    expect(screen.queryByRole("menuitem", { name: "Continue in a thread" })).toBeNull();
  });
});

describe("BoardMessage moderation", () => {
  const tools = {
    category: { key: "board", name: "Board", realm: REALM },
    saveEdit: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
  };
  const moderator = boardAccess({ isModerator: true });
  const verdicts = { moderable: true, sanctionable: true };

  it("offers a moderator hide, edit, warn and ban on a member's message", () => {
    renderMessage({ access: moderator, tools, message: boardMessage(verdicts) });
    const menu = screen.getByRole("menu");
    for (const name of ["Hide post", "Edit as moderator", "Warn author", "Ban author"]) {
      expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    }
    expect(within(menu).queryByRole("menuitem", { name: "Report" })).toBeNull();
  });

  it("offers only what the server's verdicts allow", () => {
    const { unmount } = renderMessage({
      access: moderator,
      tools,
      message: boardMessage({ moderable: true, sanctionable: false }),
    });
    expect(screen.queryByRole("menuitem", { name: "Warn author" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Ban author" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Hide post" })).toBeInTheDocument();
    unmount();
    renderMessage({
      access: moderator,
      tools,
      message: boardMessage({ moderable: false, sanctionable: true }),
    });
    expect(screen.queryByRole("menuitem", { name: "Hide post" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Edit as moderator" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Warn author" })).toBeInTheDocument();
  });

  it("has no moderator menu when the server allows nothing on the message", () => {
    renderMessage({
      access: moderator,
      tools,
      message: boardMessage({ moderable: false, sanctionable: false }),
    });
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("unhides a hidden message with the moderator's note", async () => {
    mutations.setPostHidden = jest.fn().mockResolvedValue({});
    renderMessage({
      access: moderator,
      tools,
      message: boardMessage({ hidden: true, ...verdicts }),
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Unhide post" }));
    fireEvent.click(await screen.findByRole("button", { name: "Unhide post" }));
    await waitFor(() =>
      expect(mutations.setPostHidden).toHaveBeenCalledWith({ postId: "p1", hidden: false })
    );
    await waitFor(() => expect(tools.refresh).toHaveBeenCalled());
  });

  it("edits as a moderator with a note for the log", async () => {
    renderMessage({ access: moderator, tools, message: boardMessage(verdicts) });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit as moderator" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add a note for the moderation log."
    );
    fireEvent.change(screen.getByLabelText("Note for the moderation log"), {
      target: { value: "Off topic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(tools.saveEdit).toHaveBeenCalledWith("p1", "<p>Better</p>", "Off topic")
    );
  });
});
