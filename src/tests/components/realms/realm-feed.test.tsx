import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: null }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpages: {
      getFeed: { useQuery: () => ({ data: { posts: [] }, isLoading: false, error: null }) },
    },
  },
}));
jest.mock("~/components/thinkpages/ThinkpagesPost", () => ({ ThinkpagesPost: () => null }));
jest.mock("~/app/r/[realm]/_components/RealmBoardBlock", () => ({
  RealmBoardBlock: ({ slug, framed }: { slug: string; framed?: boolean }) => (
    <div>
      board block for {slug}
      {framed ? " (framed)" : ""}
    </div>
  ),
}));

import { RealmFeed } from "~/app/r/[realm]/_components/RealmFeed";

describe("RealmFeed", () => {
  it("shows the realm's board above the posts when one realm and its slug are known", () => {
    render(<RealmFeed realmId="r_eurth" realmSlug="eurth" />);
    expect(screen.getByText("board block for eurth (framed)")).toBeInTheDocument();
    expect(screen.getByText(/No posts yet/)).toBeInTheDocument();
  });

  it("shows only the posts for every realm, or when the slug is unknown", () => {
    const all = render(<RealmFeed realmId={null} />);
    expect(all.queryByText(/board block/)).toBeNull();
    all.unmount();
    render(<RealmFeed realmId="r_x" realmSlug={null} />);
    expect(screen.queryByText(/board block/)).toBeNull();
  });
});
