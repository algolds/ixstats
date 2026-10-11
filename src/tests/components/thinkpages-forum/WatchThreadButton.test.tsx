import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockWatch = jest.fn();
const mockUnwatch = jest.fn();
const mockRefresh = jest.fn(() => Promise.resolve());
const mockThreadInvalidate = jest.fn(() => Promise.resolve());
const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ thinkpagesForum: { thread: { invalidate: mockThreadInvalidate } } }),
    thinkpagesForum: {
      watchThread: { useMutation: () => ({ mutateAsync: mockWatch, isPending: false }) },
      unwatchThread: { useMutation: () => ({ mutateAsync: mockUnwatch, isPending: false }) },
    },
  },
}));
jest.mock("~/components/thinkpages-forum/useReadStateRefresh", () => ({
  useReadStateRefresh: () => mockRefresh,
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));

import { WatchThreadButton } from "~/components/thinkpages-forum/thread/WatchThreadButton";

beforeEach(() => {
  jest.clearAllMocks();
  mockWatch.mockResolvedValue({ watching: true });
  mockUnwatch.mockResolvedValue({ watching: false });
});

describe("WatchThreadButton", () => {
  it("offers Watch, and watching refreshes the thread, the lists and the counts", async () => {
    render(<WatchThreadButton threadId="t1" watching={false} />);
    const button = screen.getByRole("button", { name: "Watch" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    await waitFor(() => expect(mockWatch).toHaveBeenCalledWith({ threadId: "t1" }));
    await waitFor(() => expect(mockThreadInvalidate).toHaveBeenCalledWith({ threadId: "t1" }));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockUnwatch).not.toHaveBeenCalled();
  });

  it("shows Watching as pressed, and a click stops watching", async () => {
    render(<WatchThreadButton threadId="t1" watching />);
    const button = screen.getByRole("button", { name: "Watching" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await waitFor(() => expect(mockUnwatch).toHaveBeenCalledWith({ threadId: "t1" }));
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it("names itself for assistive technology when it is an icon button", () => {
    const { rerender } = render(<WatchThreadButton threadId="t1" watching={false} iconOnly />);
    expect(screen.getByRole("button", { name: "Watch thread" })).toBeInTheDocument();
    rerender(<WatchThreadButton threadId="t1" watching iconOnly />);
    expect(screen.getByRole("button", { name: "Stop watching thread" })).toBeInTheDocument();
  });

  it("reports a refusal and refreshes nothing", async () => {
    mockWatch.mockRejectedValue(new Error("Thread not found."));
    render(<WatchThreadButton threadId="t1" watching={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    await waitFor(() =>
      expect(mockNotify.error).toHaveBeenCalledWith(
        "Could not update watching",
        "Thread not found."
      )
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockThreadInvalidate).not.toHaveBeenCalled();
  });
});
