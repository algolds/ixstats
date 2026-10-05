import { fireEvent, render, screen } from "@testing-library/react";
import { PostCard } from "~/components/forum/reader/PostCard";

jest.mock("~/lib/utils", () => ({
  ...jest.requireActual("~/lib/utils"),
  sanitizeHtml: (html: string) => html,
}));

describe("forum PostCard edit", () => {
  it("opens the editor prefilled with the post's current message", () => {
    render(
      <PostCard
        postId={7}
        threadId={3}
        authorId={11}
        authorName="Ada"
        authorAvatar={null}
        authorTitle={null}
        authorMessageCount={0}
        authorReactionScore={0}
        authorJoinDate={0}
        postDate={0}
        contentHtml="<p><b>hello</b></p>"
        message="[B]hello[/B]"
        isFirstPost={false}
        reactionScore={0}
        position={1}
        attachments={[]}
        currentForumUserId={11}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox")).toHaveValue("[B]hello[/B]");
  });
});
