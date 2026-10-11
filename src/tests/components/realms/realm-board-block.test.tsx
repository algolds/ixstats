import React from "react";
import { render, screen } from "@testing-library/react";
import type { RouterOutputs } from "~/trpc/react";

type Preview = RouterOutputs["thinkpagesForum"]["realmBoardPreview"];

const state: { data: Preview | undefined; loading: boolean; input: { slug: string } | undefined } =
  { data: undefined, loading: false, input: undefined };
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpagesForum: {
      realmBoardPreview: {
        useQuery: (input: { slug: string }) => {
          state.input = input;
          return { data: state.data, isLoading: state.loading };
        },
      },
    },
  },
}));

import { RealmBoardBlock } from "~/app/r/[realm]/_components/RealmBoardBlock";

const preview = (messages: NonNullable<Preview>["messages"], slug = "eurth"): Preview => ({
  realm: { slug, name: "Eurth", emblemUrl: null, thumbnail: null },
  messages,
});
const message = (id: string, excerpt: string, slug = "eurth") => ({
  id,
  author: { name: "jane", avatarUrl: null, flagUrl: null, persona: false },
  excerpt,
  createdAt: new Date(Date.now() - 120_000),
  href: `/thinkpages/r/${slug}#post-${id}`,
});

beforeEach(() => {
  state.data = undefined;
  state.loading = false;
});

describe("RealmBoardBlock", () => {
  it("asks for the realm by slug", () => {
    state.data = preview([]);
    render(<RealmBoardBlock slug="eurth" />);
    expect(state.input).toEqual({ slug: "eurth" });
  });

  it("lists the latest messages under On the board, with a link to open it", () => {
    state.data = preview([message("p2", "Second one"), message("p1", "First one")]);
    render(<RealmBoardBlock slug="eurth" />);
    expect(screen.getByRole("heading", { name: "On the board" })).toBeInTheDocument();
    expect(screen.getByText("Eurth")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Second one/ })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth#post-p2"
    );
    expect(screen.getByRole("link", { name: "Open the board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth"
    );
  });

  it("links the board by the canonical slug the server returned, not the one asked for", () => {
    state.data = preview([], "eurth");
    render(<RealmBoardBlock slug="Eurth-Old" />);
    expect(screen.getByRole("link", { name: "Open the board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth"
    );
  });

  it("says so in one line when nobody has posted", () => {
    state.data = preview([]);
    render(<RealmBoardBlock slug="eurth" />);
    expect(screen.getByText("Nobody has posted on the board yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the board" })).toBeInTheDocument();
  });

  it("renders nothing for a hidden or unknown realm, or a failed read", () => {
    state.data = null;
    expect(render(<RealmBoardBlock slug="draft" />).container).toBeEmptyDOMElement();
    state.data = undefined;
    expect(render(<RealmBoardBlock slug="eurth" />).container).toBeEmptyDOMElement();
  });

  it("shows a skeleton that keeps its class, and no heading, while loading", () => {
    state.loading = true;
    const { container } = render(<RealmBoardBlock slug="eurth" className="mb-5" />);
    expect(container.firstChild).toHaveClass("mb-5");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("frames itself when asked and takes a class otherwise", () => {
    state.data = preview([]);
    const framed = render(<RealmBoardBlock slug="eurth" framed />);
    expect(framed.container.firstChild).toHaveClass("border-separator", "rounded-card", "border");
    const plain = render(<RealmBoardBlock slug="eurth" className="mb-5" />);
    expect(plain.container.firstChild).toHaveClass("mb-5");
  });
});
