import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { thinkpagesForum: { myPersonas: { useQuery: () => ({ data: [] }) } } },
}));

interface StubProps {
  initialWikitext?: string;
  onWikitextChange?: (text: string) => void;
  onSubmit: (text: string, meta: object) => Promise<{ formatting: "done" | "pending" }>;
  fill?: boolean;
}

jest.mock("~/components/thinkpages-forum/composer/CanvasComposer", () => ({
  CanvasComposer: ({ initialWikitext, onWikitextChange, onSubmit, fill }: StubProps) => (
    <div data-testid="canvas" data-initial={initialWikitext} data-fill={String(!!fill)}>
      <button type="button" onClick={() => onWikitextChange?.("my draft")}>
        Type
      </button>
      <button
        type="button"
        onClick={() => void onSubmit("my draft", { personaId: null, title: "" })}
      >
        Send
      </button>
    </div>
  ),
}));

import { ReplyComposer } from "~/components/thinkpages-forum/composer";

function Host({ phone, formatting = "done" }: { phone: boolean; formatting?: "done" | "pending" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <ReplyComposer
      icAllowed={false}
      threadId="t1"
      phone={phone}
      open={open}
      onOpenChange={setOpen}
      onSubmit={async () => ({ formatting })}
    />
  );
}

describe("ReplyComposer", () => {
  it("is the composer under the posts, in the reply section, on wide screens", () => {
    const { container } = render(<Host phone={false} />);
    expect(container.querySelector("section#reply")).toContainElement(screen.getByTestId("canvas"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a docked Reply bar above the tab bar on a phone, with no composer until it is opened", () => {
    const { container } = render(<Host phone />);
    expect(screen.queryByTestId("canvas")).toBeNull();
    const dock = container.querySelector('[data-slot="reply-dock"]');
    expect(dock).toHaveClass("fixed");
    // Sits on the shell's own tab bar offset, not a hard-coded height.
    expect(dock?.className).toContain("var(--shell-tabbar-height)");
    expect(dock).toContainElement(screen.getByRole("button", { name: "Reply" }));
  });

  it("opens the composer in a full-height sheet and keeps the draft when the sheet is closed", async () => {
    render(<Host phone />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "bottom-detent");
    expect(dialog).toContainElement(screen.getByTestId("canvas"));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-fill", "true");
    fireEvent.click(screen.getByText("Type"));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByTestId("canvas")).toHaveAttribute("data-initial", "my draft");
  });

  it("closes the sheet after a reply is posted", async () => {
    render(<Host phone />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the sheet open when the wiki is still formatting the reply, so the author is told", async () => {
    render(<Host phone formatting="pending" />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Send"));
    // Let the submit settle: the sheet would be closing by now if it were going to.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
