import { fireEvent, render, screen } from "@testing-library/react";
import {
  StashThreadsList,
  stashedThreadTarget,
} from "~/components/wiki-os/stashes/StashThreadsList";
import type { StashedThreadItem } from "~/components/wiki-os/stashes/types";

const native: StashedThreadItem = {
  id: "i1",
  pageTitle: "thinkpages:thread:cabc123",
  pageSlug: "/thinkpages/t/cabc123",
  note: "A native thread",
  savedAt: "2026-10-01T00:00:00.000Z",
};
const legacy: StashedThreadItem = {
  id: "i2",
  pageTitle: "forum:thread:77",
  pageSlug: "/forum/thread/77",
  note: "An old thread",
  savedAt: "2026-09-01T00:00:00.000Z",
};

describe("stashedThreadTarget", () => {
  it("opens a native item on its ThinkPages thread, built from the id in its title", () => {
    expect(stashedThreadTarget(native)).toEqual({
      title: "A native thread",
      href: "/thinkpages/t/cabc123",
    });
    // The stored path is never trusted: the id in the title decides.
    expect(stashedThreadTarget({ ...native, pageSlug: "https://evil.example/x" }).href).toBe(
      "/thinkpages/t/cabc123"
    );
  });

  it("keeps a legacy item on its bridge path, which the forum redirects resolve", () => {
    expect(stashedThreadTarget(legacy)).toEqual({
      title: "An old thread",
      href: "/forum/thread/77",
    });
    expect(stashedThreadTarget({ ...legacy, pageSlug: "forum:thread:77", note: null })).toEqual({
      title: "Thread #77",
      href: "/forum/thread/77",
    });
  });

  it("names a native item whose note is missing", () => {
    expect(stashedThreadTarget({ ...native, note: null }).title).toBe("Thread");
  });
});

describe("StashThreadsList", () => {
  it("lists native and legacy threads side by side with their own links", () => {
    render(<StashThreadsList items={[native, legacy]} onUnstash={jest.fn()} />);

    expect(screen.getByRole("heading", { name: "A native thread" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "An old thread" })).toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/thinkpages/t/cabc123",
      "/thinkpages/t/cabc123",
      "/forum/thread/77",
      "/forum/thread/77",
    ]);
  });

  it("unstashes by the item's own title", () => {
    const onUnstash = jest.fn();
    render(<StashThreadsList items={[native, legacy]} onUnstash={onUnstash} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove from stash" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove from stash" })[1]!);

    expect(onUnstash.mock.calls).toEqual([["thinkpages:thread:cabc123"], ["forum:thread:77"]]);
  });
});
