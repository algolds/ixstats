/**
 * Plan 413 review: dragging the revision slider across many positions asks for one diff, for the
 * position it settles on, not one per step.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ScrubbableRevisionTimeline } from "~/components/wiki-os/history/ScrubbableRevisionTimeline";

/** The distinct queries asked for, in order (a render with an unchanged query asks nothing new). */
const asked: string[] = [];
let lastKey = "";
const mockGetDiff = (input: unknown) => {
  const key = JSON.stringify(input);
  if (key !== lastKey) asked.push(key);
  lastKey = key;
};
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { getHistory: { invalidate: jest.fn() } } }),
    wikios: {
      revertToRevision: {
        useMutation: () => ({ mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null }),
      },
      rollback: { useMutation: () => ({ mutate: jest.fn(), isPending: false, error: null }) },
      getDiff: {
        useQuery: (input: unknown, options: { enabled?: boolean }) => {
          if (options.enabled) mockGetDiff(input);
          return { data: { hunks: [], trailingSkipped: 0, added: 0, removed: 0 }, error: null };
        },
      },
    },
  },
}));
jest.mock("~/components/diff-viewer", () => ({ DiffViewer: () => <div data-testid="diff" /> }));

const revision = (id: string) => ({
  id,
  articleId: "a1",
  author: "amy",
  summary: null,
  minor: false,
  byteSize: 10,
  createdAt: new Date("2026-06-01T00:00:00Z"),
});

describe("ScrubbableRevisionTimeline diff requests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    asked.length = 0;
    lastKey = "";
  });
  afterEach(() => jest.useRealTimers());

  it("asks once for the settled position, and shows a spinner while the slider moves", () => {
    render(
      <ScrubbableRevisionTimeline
        title="Foo"
        slug="foo"
        revisions={["r6", "r5", "r4", "r3", "r2", "r1"].map(revision)}
      />
    );
    // the first diff (latest against its predecessor) is asked for at once
    expect(asked).toEqual([JSON.stringify({ fromrev: "r5", torev: "r6" })]);
    asked.length = 0;

    expect(screen.getByTestId("diff")).toBeInTheDocument();
    const slider = screen.getByRole("slider");
    for (const position of [1, 2, 3, 4, 5]) {
      fireEvent.change(slider, { target: { value: String(position) } });
      act(() => {
        jest.advanceTimersByTime(100); // faster than the settle time
      });
    }
    expect(asked).toEqual([]);
    // the diff shown is for another pair of revisions than the ones now selected: no stale diff
    expect(screen.queryByTestId("diff")).toBeNull();
    expect(document.querySelector(".animate-spin")).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(asked).toEqual([JSON.stringify({ fromrev: "r5", torev: "r1" })]);
    expect(screen.getByTestId("diff")).toBeInTheDocument();
  });
});
