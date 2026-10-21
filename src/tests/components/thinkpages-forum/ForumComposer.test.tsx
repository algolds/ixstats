import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const editorFocusEnd = jest.fn();
const editorInsert = jest.fn();
const editorClear = jest.fn();

interface MockEditorProps {
  onChange?: (html: string, plain: string, bbcode: string) => void;
  placeholder?: string;
  allowImageInsert?: boolean;
  mentionSource?: object;
  ref?: React.Ref<{ focusEnd: () => void; insertText: (t: string) => void; clear: () => void }>;
}

jest.mock(
  "next/dynamic",
  () => () =>
    function Editor({
      ref,
      onChange,
      placeholder,
      allowImageInsert,
      mentionSource,
    }: MockEditorProps) {
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
          data-mention-source={String(!!mentionSource)}
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
  it("keeps the content and shows the error when submit fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Nope"));
    render(<ForumComposer icAllowed={false} onSubmit={onSubmit} />);
    type("hello");
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(editorClear).not.toHaveBeenCalled();
  });
});
