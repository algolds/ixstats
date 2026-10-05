import React from "react";
import { render } from "@testing-library/react";

const editorFocus = jest.fn();
jest.mock(
  "next/dynamic",
  () => () =>
    function Editor({ ref }: { ref?: React.Ref<{ focus: () => void }> }) {
      React.useImperativeHandle(ref, () => ({ focus: editorFocus }), []);
      return <div data-testid="editor" />;
    }
);
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ forum: { getThread: { invalidate: jest.fn() } } }),
    forum: {
      createPost: { useMutation: () => ({ error: null, isPending: false, mutate: jest.fn() }) },
    },
  },
}));

import { ReplyComposer, type ReplyComposerHandle } from "~/components/forum/composer/ReplyComposer";

describe("ReplyComposer handle", () => {
  it("focus() puts the caret in the editor", () => {
    const handle = React.createRef<ReplyComposerHandle>();
    render(<ReplyComposer ref={handle} threadId={1} />);
    handle.current?.focus();
    expect(editorFocus).toHaveBeenCalledTimes(1);
  });
});
