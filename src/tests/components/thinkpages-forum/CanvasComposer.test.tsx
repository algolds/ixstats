import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

interface FakeEditorProps {
  initialWikitext?: string;
  bare?: boolean;
  compactToolbar?: boolean;
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
      compactToolbar,
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
          data-compact={String(compactToolbar)}
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
import { insertAtCaret } from "~/components/thinkpages-forum/composer/canvas-ops";

const insert = jest.mocked(insertAtCaret);

const write = (text: string) =>
  fireEvent.change(screen.getByTestId("canvas"), { target: { value: text } });

describe("CanvasComposer", () => {
  beforeEach(() => jest.clearAllMocks());
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
  it("will not submit content that has no wikitext form yet", () => {
    render(<CanvasComposer mode="reply" threadId="t1" onSubmit={jest.fn()} />);
    write("INCOMPLETE");
    expect(screen.getByRole("button", { name: "Reply" })).toBeDisabled();
    expect(screen.getByText(/cannot be saved/i)).toBeInTheDocument();
  });
  describe("prefill from the address", () => {
    afterEach(() => {
      jest.useRealTimers();
      window.history.replaceState(null, "", "/");
    });
    it("does not insert again when the composer remounts after the prefill", async () => {
      window.history.replaceState(null, "", "/thinkpages/c/general/new?attach=dir-abc");
      const first = render(<CanvasComposer mode="thread" onSubmit={jest.fn()} />);
      await waitFor(() => expect(window.location.search).toBe(""));
      first.unmount();
      render(<CanvasComposer mode="thread" onSubmit={jest.fn()} />);
      await act(async () => undefined);
      expect(insert).toHaveBeenCalledTimes(1);
    });
  });
});
