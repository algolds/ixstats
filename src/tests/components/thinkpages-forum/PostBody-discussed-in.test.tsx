import { render, screen } from "@testing-library/react";

jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html }: { html: string }) => (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));
jest.mock("~/components/thinkpages-forum/thread/WikiEmbed", () => ({ WikiEmbeds: () => null }));
jest.mock("~/components/action-links/DiscussedIn", () => ({
  DiscussedInBadge: ({
    activityId,
    excludePostId,
  }: {
    activityId: string;
    excludePostId?: string;
  }) => <span data-testid="badge">{`${activityId}|${excludePostId ?? ""}`}</span>,
}));

import { PostBody } from "~/components/thinkpages-forum/thread/PostBody";
import type { ActionCardData } from "~/components/action-links";

const card: ActionCardData = {
  id: "a1",
  title: "Signed treaty",
  type: "diplomatic",
  createdAt: new Date(0),
  country: null,
};

describe("PostBody discussed-in badge", () => {
  it("shows a badge under a verified card, naming the post that shows it", () => {
    render(
      <PostBody
        html="<p>x</p>[ixaction=a1]"
        style="ooc"
        cards={new Map([["a1", card]])}
        cardsReady
        postId="p7"
      />
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("a1|p7");
  });

  it("shows no badge under an unverified card", () => {
    render(<PostBody html="[ixaction=zz]" style="ooc" cards={new Map()} cardsReady postId="p7" />);
    expect(screen.queryByTestId("badge")).toBeNull();
    expect(screen.getByText("Unverified action")).toBeInTheDocument();
  });

  it("passes no post when none is given (a preview)", () => {
    render(
      <PostBody html="[ixaction=a1]" style="ooc" cards={new Map([["a1", card]])} cardsReady />
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("a1|");
  });
});
