/** Halo CompactView toast peek: dismissing or mutating the queue before 2.5 s does not cancel the hide timer. */
import { act, render, screen } from "@testing-library/react";
import { CompactView } from "~/components/halo/views/CompactView";
import { useToastQueueStore } from "~/stores/toastQueueStore";

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
}));
jest.mock("~/components/wiki-os/shared/WikiContext", () => ({
  useWikiContext: () => ({
    activeSectionId: null,
    tocEntries: [],
    narratorState: null,
    themeColors: null,
  }),
}));
jest.mock("~/hooks/useContextHour", () => ({
  useContextHour: () => 9,
}));
jest.mock("~/hooks/useHydrated", () => ({
  useHydrated: () => true,
}));
jest.mock("~/hooks/useMessageUnreadCount", () => ({
  useMessageUnreadCount: () => ({ totalUnread: 0 }),
}));
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

beforeEach(() => {
  jest.useFakeTimers();
  useToastQueueStore.getState().dismissAll();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("CompactView toast peek", () => {
  it("hides the peek after 2.5 s even when the toast is dismissed within 1 s", () => {
    render(
      <CompactView
        mode="compact"
        isSticky
        isCollapsed={false}
        setIsCollapsed={jest.fn()}
        setIsUserInteracting={jest.fn()}
        onSwitchMode={jest.fn()}
        activePlugin={null}
        pluginCenter={null}
        pluginActions={undefined}
        pluginBadge={undefined}
      />
    );

    let toastId = "";
    act(() => {
      toastId = useToastQueueStore.getState().enqueue({
        title: "Treaty ratified",
        type: "info",
        priority: "high",
      });
    });
    expect(screen.getByText("Treaty ratified")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(800);
      useToastQueueStore.getState().dismiss(toastId);
    });
    expect(screen.getByText("Treaty ratified")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1800);
    });
    expect(screen.queryByText("Treaty ratified")).toBeNull();
  });
});
