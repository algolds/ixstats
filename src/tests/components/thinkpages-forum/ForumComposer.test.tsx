import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const editorFocusEnd = jest.fn();
const editorInsert = jest.fn();
const editorClear = jest.fn();

interface MockEditorProps {
  onChange?: (html: string, plain: string, bbcode: string) => void;
  placeholder?: string;
  allowImageInsert?: boolean;
  ref?: React.Ref<{ focusEnd: () => void; insertText: (t: string) => void; clear: () => void }>;
}

jest.mock(
  "next/dynamic",
  () => () =>
    function Editor({ ref, onChange, placeholder, allowImageInsert }: MockEditorProps) {
      React.useImperativeHandle(
        ref,
        () => ({ focusEnd: editorFocusEnd, insertText: editorInsert, clear: editorClear }),
        []
      );
      return (
        <textarea
          data-testid="editor"
          placeholder={placeholder}
          data-allow-image={String(allowImageInsert)}
          onChange={(e) => {
            const value = e.target.value;
            // "img:<src>" stands for an inserted image with no text around it.
            if (value.startsWith("img:"))
              onChange?.(`<p><img src="${value.slice(4)}" alt=""></p>`, "", "");
            else onChange?.(`<p>${value}</p>`, value, value);
          }}
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

jest.mock("~/trpc/react", () => ({
  api: {
    thinkpagesForum: {
      myPersonas: {
        useQuery: () => ({
          data: [{ id: "p1", displayName: "Aria", username: "aria" }],
        }),
      },
    },
  },
}));

import { ForumComposer } from "~/components/thinkpages-forum/ForumComposer";

function type(text: string) {
  fireEvent.change(screen.getByTestId("editor"), { target: { value: text } });
}

describe("ForumComposer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("focuses the editor on one mouse down anywhere on the composer surface", () => {
    const { container } = render(<ForumComposer icAllowed={false} onSubmit={jest.fn()} />);
    const surface = container.querySelector("[data-slot='forum-composer']");
    expect(surface).not.toBeNull();
    fireEvent.mouseDown(surface as Element);
    expect(editorFocusEnd).toHaveBeenCalledTimes(1);
  });

  it("ignores non-primary mouse buttons", () => {
    const { container } = render(<ForumComposer icAllowed={false} onSubmit={jest.fn()} />);
    fireEvent.mouseDown(container.querySelector("[data-slot='forum-composer']") as Element, {
      button: 2,
    });
    expect(editorFocusEnd).not.toHaveBeenCalled();
  });

  it("does not steal focus from the editor or from form controls", () => {
    render(<ForumComposer icAllowed={false} titleField onSubmit={jest.fn()} />);
    fireEvent.mouseDown(screen.getByTestId("editor"));
    fireEvent.mouseDown(screen.getByPlaceholderText("Thread title"));
    expect(editorFocusEnd).not.toHaveBeenCalled();
  });

  it("shows the persona select only when icAllowed", () => {
    const { rerender } = render(<ForumComposer icAllowed={false} onSubmit={jest.fn()} />);
    expect(screen.queryByText("Post as")).toBeNull();
    rerender(<ForumComposer icAllowed onSubmit={jest.fn()} />);
    expect(screen.getByText("Post as")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("focuses at the end, inserts the picked action token, then refocuses on the next frame", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    render(<ForumComposer icAllowed={false} onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText("Attach action"));
    expect(editorInsert).toHaveBeenCalledWith("[ixaction=a1]");
    expect(editorFocusEnd.mock.invocationCallOrder[0]).toBeLessThan(
      editorInsert.mock.invocationCallOrder[0] ?? 0
    );
    expect(editorFocusEnd).toHaveBeenCalledTimes(1);
    frames.forEach((cb) => cb(0));
    expect(editorFocusEnd).toHaveBeenCalledTimes(2);
    raf.mockRestore();
  });

  it("disables Post while empty and submits html with a null persona", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ForumComposer icAllowed={false} onSubmit={onSubmit} />);
    const post = screen.getByRole("button", { name: "Post" });
    expect(post).toBeDisabled();
    type("hello");
    expect(post).toBeEnabled();
    fireEvent.click(post);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ html: "<p>hello</p>", personaId: null })
    );
    await waitFor(() => expect(editorClear).toHaveBeenCalled());
    expect(post).toBeDisabled();
  });

  it("opts the editor into image inserts", () => {
    render(<ForumComposer icAllowed={false} onSubmit={jest.fn()} />);
    expect(screen.getByTestId("editor")).toHaveAttribute("data-allow-image", "true");
  });

  it("submits an image-only post and keeps Post disabled for an image with no src", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ForumComposer icAllowed={false} onSubmit={onSubmit} />);
    const post = screen.getByRole("button", { name: "Post" });
    type("img:");
    expect(post).toBeDisabled();
    type("img:data:image/png;base64,AAAA");
    expect(post).toBeDisabled();
    type("img:javascript:alert(1)");
    expect(post).toBeDisabled();
    type("img:x");
    expect(post).toBeDisabled();
    type("img:/api/mediawiki/commons/Special:Filepath/A%20b.png");
    expect(post).toBeEnabled();
    type("img:/images/uploads/a.png");
    expect(post).toBeEnabled();
    fireEvent.click(post);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        html: '<p><img src="/images/uploads/a.png" alt=""></p>',
        personaId: null,
      })
    );
  });

  it("requires a title when titleField is set and sends it", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <ForumComposer icAllowed={false} titleField submitLabel="Start thread" onSubmit={onSubmit} />
    );
    const post = screen.getByRole("button", { name: "Start thread" });
    type("body");
    expect(post).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Thread title"), { target: { value: "Topic" } });
    fireEvent.click(post);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        html: "<p>body</p>",
        personaId: null,
        title: "Topic",
      })
    );
  });

  it("keeps the content and shows the error when submit fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Nope"));
    render(<ForumComposer icAllowed={false} onSubmit={onSubmit} />);
    type("hello");
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(editorClear).not.toHaveBeenCalled();
  });

  it("gives each composer's persona label its own id (reply and edit share the thread page)", () => {
    render(
      <>
        <ForumComposer icAllowed onSubmit={jest.fn()} />
        <ForumComposer icAllowed onSubmit={jest.fn()} />
      </>
    );
    const [first, second] = screen.getAllByRole("combobox");
    const a = first?.getAttribute("aria-labelledby");
    const b = second?.getAttribute("aria-labelledby");
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    expect(document.getElementById(a ?? "")).toHaveTextContent("Post as");
  });

  it("starts from initialHtml with Save enabled, for editing", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <ForumComposer
        icAllowed={false}
        initialHtml="<p>old</p>"
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ html: "<p>old</p>", personaId: null })
    );
  });
});
