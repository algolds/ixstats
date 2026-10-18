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
const second: StashedThreadItem = {
  id: "i2",
  pageTitle: "thinkpages:thread:cdef456",
  pageSlug: "/thinkpages/t/cdef456",
  note: "Another thread",
  savedAt: "2026-09-01T00:00:00.000Z",
};
/** Not a native thread item: the listing never passes one, and the list has nowhere to open it. */
const other: StashedThreadItem = {
  id: "i3",
  pageTitle: "Main_Page",
  pageSlug: "Main_Page",
  note: "Not a thread",
  savedAt: "2026-09-01T00:00:00.000Z",
};

describe("stashedThreadTarget", () => {
  it("opens a native item on its ThinkPages thread, built from the id in its title", () => {
    expect(stashedThreadTarget(native)).toEqual({
      title: "A native thread",
      href: "/thinkpages/t/cabc123",
    });
    // The stored path is never trusted: the id in the title decides.
    expect(stashedThreadTarget({ ...native, pageSlug: "https://evil.example/x" })?.href).toBe(
      "/thinkpages/t/cabc123"
    );
  });

  it("names a native item whose note is missing", () => {
    expect(stashedThreadTarget({ ...native, note: null })?.title).toBe("Thread");
  });

  it("has no target for an item that is not a native thread", () => {
    expect(stashedThreadTarget(other)).toBeNull();
  });
});

describe("StashThreadsList", () => {
  it("lists native threads with links to them, and leaves out anything else", () => {
    render(<StashThreadsList items={[native, other, second]} onUnstash={jest.fn()} />);

    expect(screen.getByRole("heading", { name: "A native thread" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Another thread" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Not a thread" })).not.toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/thinkpages/t/cabc123",
      "/thinkpages/t/cabc123",
      "/thinkpages/t/cdef456",
      "/thinkpages/t/cdef456",
    ]);
  });

  it("unstashes by the item's own title", () => {
    const onUnstash = jest.fn();
    render(<StashThreadsList items={[native, second]} onUnstash={onUnstash} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove from stash" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove from stash" })[1]!);

    expect(onUnstash.mock.calls).toEqual([
      ["thinkpages:thread:cabc123"],
      ["thinkpages:thread:cdef456"],
    ]);
  });
});
