import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

interface FakeEditorProps {
  initialWikitext?: string;
  bare?: boolean;
  onSerializedWikitext?: (r: { wikitext: string; complete: boolean; notices: string[] }) => void;
  onEditorReady?: (editor: object) => void;
}

// The Canvas editor stands in as a textarea that reports its text the way WikiVisualEditor does.
jest.mock(
  "next/dynamic",
  () => () =>
    function FakeCanvas({
      initialWikitext,
      bare,
      onSerializedWikitext,
      onEditorReady,
    }: FakeEditorProps) {
      React.useEffect(() => {
        onSerializedWikitext?.({ wikitext: initialWikitext ?? "", complete: true, notices: [] });
        onEditorReady?.({ fake: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <textarea
          data-testid="canvas"
          data-bare={String(bare)}
          defaultValue={initialWikitext}
          onChange={(e) =>
            onSerializedWikitext?.({
              wikitext: e.target.value,
              complete: !e.target.value.includes("INCOMPLETE"),
              notices: [],
            })
          }
        />
      );
    }
);

jest.mock("~/components/action-links", () => ({
  ActionPicker: ({ onPick }: { onPick: (token: string) => void }) => (
    <button type="button" onClick={() => onPick("[ixaction=a1]")}>
      Attach action
    </button>
  ),
}));

jest.mock("~/components/thinkpages-forum/composer/canvas-ops", () => ({
  insertAtCaret: jest.fn(),
  appendQuote: jest.fn(),
}));

jest.mock("~/components/thinkpages-forum/thread/PostBody", () => ({
  PostBody: ({ html, style }: { html: string; style: string }) => (
    <div data-testid="post-body" data-style={style} dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));

jest.mock("~/trpc/react", () => {
  const previewPost = jest.fn();
  return {
    previewPost,
    api: {
      thinkpagesForum: {
        previewPost: { useMutation: () => ({ mutateAsync: previewPost }) },
      },
    },
  };
});

import { CanvasComposer } from "~/components/thinkpages-forum/composer";
import { appendQuote, insertAtCaret } from "~/components/thinkpages-forum/composer/canvas-ops";

const { previewPost } = jest.requireMock<{ previewPost: jest.Mock }>("~/trpc/react");
const insert = jest.mocked(insertAtCaret);
const append = jest.mocked(appendQuote);

const write = (text: string) =>
  fireEvent.change(screen.getByTestId("canvas"), { target: { value: text } });

describe("CanvasComposer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hosts the Canvas editor without the page chrome and submits the wikitext", async () => {
    const onSubmit = jest.fn(async () => ({ formatting: "done" as const }));
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={onSubmit} />);
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-bare", "true");
    const send = screen.getByRole("button", { name: "Reply" });
    expect(send).toBeDisabled();
    write("Hello ''world''");
    fireEvent.click(send);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Hello ''world''", { personaId: null, title: "" })
    );
  });

  it("starts an edit from the post's wikitext and saves it", async () => {
    const onSubmit = jest.fn(async () => ({ formatting: "done" as const }));
    render(
      <CanvasComposer
        mode="edit"
        initialWikitext="Original '''text'''"
        threadId="t1"
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByTestId("canvas")).toHaveValue("Original '''text'''");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Original '''text'''", expect.anything())
    );
    // An edit keeps what the author wrote.
    expect(screen.getByTestId("canvas")).toHaveValue("Original '''text'''");
  });

  it("asks for a title in thread mode and sends it", async () => {
    const onSubmit = jest.fn(async () => ({ formatting: "done" as const }));
    render(<CanvasComposer mode="thread" onSubmit={onSubmit} />);
    write("Body");
    const send = screen.getByRole("button", { name: "Post thread" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Thread title"), { target: { value: "  Rivers  " } });
    fireEvent.click(send);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Body", { personaId: null, title: "Rivers" })
    );
  });

  it("shows Preview from the server render, nothing saved", async () => {
    previewPost.mockResolvedValue({ html: "<p>Rendered</p>", pending: false });
    const onSubmit = jest.fn();
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={onSubmit} />);
    write("Hello");
    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
    expect(await screen.findByTestId("post-body")).toHaveTextContent("Rendered");
    expect(previewPost).toHaveBeenCalledWith({ wikitext: "Hello", threadId: "t1" });
    expect(onSubmit).not.toHaveBeenCalled();
    // Back to Write keeps the text.
    fireEvent.click(screen.getByRole("radio", { name: "Write" }));
    expect(screen.getByTestId("canvas")).toHaveValue("Hello");
  });

  it("says so when the preview is only approximate, and shows a failed preview's message", async () => {
    previewPost.mockResolvedValueOnce({ html: "<p>Rough</p>", pending: true });
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={jest.fn()} />);
    write("Hello");
    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
    expect(await screen.findByText("Formatting will finish shortly")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Write" }));
    previewPost.mockRejectedValueOnce(new Error("Signatures are not allowed here."));
    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
    expect(await screen.findByText("Signatures are not allowed here.")).toBeInTheDocument();
  });

  it("tells the author formatting will finish shortly after a pending save, and clears a reply", async () => {
    const onSubmit = jest.fn(async () => ({ formatting: "pending" as const }));
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={onSubmit} />);
    write("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByText("Formatting will finish shortly")).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toHaveValue("");
  });

  it("shows the server's message in a Signal and keeps the text when the post is refused", async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error(
        "You're posting faster than the wiki can format. Try again in a few seconds."
      );
    });
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={onSubmit} />);
    write("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You're posting faster than the wiki can format.");
    expect(screen.getByTestId("canvas")).toHaveValue("Hello");
    // Try again is possible.
    expect(screen.getByRole("button", { name: "Reply" })).toBeEnabled();
  });

  it("drops the last save's Signal when the content changes, but not when a posted reply clears", async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error("Signatures are not allowed here."))
      .mockResolvedValueOnce({ formatting: "pending" });
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={onSubmit} />);
    write("Hello ~~~~");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByText("Signatures are not allowed here.")).toBeInTheDocument();
    write("Hello");
    expect(screen.queryByText("Signatures are not allowed here.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByText("Formatting will finish shortly")).toBeInTheDocument();
    // The editor cleared itself, which is not an edit.
    expect(screen.getByTestId("canvas")).toHaveValue("");
    expect(screen.getByText("Formatting will finish shortly")).toBeInTheDocument();
    write("Next reply");
    expect(screen.queryByText("Formatting will finish shortly")).toBeNull();
  });

  it("makes the editor and Attach action inert while the post is being sent", async () => {
    let finish: (value: { formatting: "done" }) => void = () => undefined;
    const onSubmit = jest.fn(
      () => new Promise<{ formatting: "done" }>((resolve) => (finish = resolve))
    );
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={onSubmit} />);
    write("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() => expect(screen.getByTestId("canvas").closest("[inert]")).not.toBeNull());
    expect(screen.getByRole("button", { name: "Attach action" }).closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Reply" })).toBeDisabled();
    finish({ formatting: "done" });
    await waitFor(() => expect(screen.getByTestId("canvas").closest("[inert]")).toBeNull());
  });

  it("will not submit content that has no wikitext form yet", () => {
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={jest.fn()} />);
    write("INCOMPLETE");
    expect(screen.getByRole("button", { name: "Reply" })).toBeDisabled();
    expect(screen.getByText(/cannot be saved/i)).toBeInTheDocument();
  });

  it("Attach action inserts the token into the editor", () => {
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Attach action" }));
    expect(insert).toHaveBeenCalledWith({ fake: true }, "[ixaction=a1]");
  });

  it("inserts a quote request once into the open editor", () => {
    const quote = { postId: "p9", author: "Urcea", text: "Hi" };
    const done = jest.fn();
    const { rerender } = render(
      <CanvasComposer
        mode="reply"
        threadId="t1"
        onSubmit={jest.fn()}
        quoteRequest={quote}
        onQuoteInserted={done}
      />
    );
    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith({ fake: true }, quote);
    expect(done).toHaveBeenCalledTimes(1);
    rerender(
      <CanvasComposer
        mode="reply"
        threadId="t1"
        onSubmit={jest.fn()}
        quoteRequest={quote}
        onQuoteInserted={done}
      />
    );
    expect(append).toHaveBeenCalledTimes(1);
    const second = { ...quote };
    rerender(
      <CanvasComposer
        mode="reply"
        threadId="t1"
        onSubmit={jest.fn()}
        quoteRequest={second}
        onQuoteInserted={done}
      />
    );
    expect(append).toHaveBeenCalledTimes(2);
  });

  it("offers the persona switcher as 'Posting as'", () => {
    render(
      <CanvasComposer
        mode="reply"
        threadId="t1"
        onSubmit={jest.fn()}
        personas={[{ id: "pa1", displayName: "Aria", username: "aria" }]}
      />
    );
    expect(screen.getByText("Posting as")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Yourself");
  });

  it("has no persona line when there are no personas", () => {
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={jest.fn()} />);
    expect(screen.queryByText("Posting as")).toBeNull();
  });

  it("reports the draft so a closed sheet can reopen on it", () => {
    const onWikitextChange = jest.fn();
    render(
      <CanvasComposer
        mode="reply"
        threadId="t1"
        onSubmit={jest.fn()}
        onWikitextChange={onWikitextChange}
      />
    );
    write("draft");
    expect(onWikitextChange).toHaveBeenLastCalledWith("draft");
  });
});
