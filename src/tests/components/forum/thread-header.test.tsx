import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThreadHeader } from "~/components/forum/reader/ThreadHeader";

const notifySuccess = jest.fn();
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: notifySuccess }),
}));

const thread = {
  title: "Budget talks",
  authorName: "Ada",
  replyCount: 1200,
  viewCount: 34,
  isOpen: true,
};

const setShare = (share: unknown) =>
  Object.defineProperty(navigator, "share", { value: share, configurable: true });

describe("ThreadHeader", () => {
  beforeEach(() => {
    notifySuccess.mockClear();
    setShare(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("shows the title and thread facts", () => {
    render(<ThreadHeader thread={thread} onReply={jest.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Budget talks" })).toBeInTheDocument();
    expect(screen.getByText("by Ada")).toBeInTheDocument();
    expect(screen.getByText(/1,200 replies/)).toBeInTheDocument();
  });

  it("Reply goes to the composer", () => {
    const onReply = jest.fn();
    render(<ThreadHeader thread={thread} onReply={onReply} />);

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it("a closed thread has no Reply action but can still be shared", () => {
    render(<ThreadHeader thread={{ ...thread, isOpen: false }} onReply={jest.fn()} />);

    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("Share copies the thread link when there is no share sheet", async () => {
    render(<ThreadHeader thread={thread} onReply={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Link copied to clipboard"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("Share opens the share sheet when the browser has one", () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setShare(share);
    render(<ThreadHeader thread={thread} onReply={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(share).toHaveBeenCalledWith({ title: "Budget talks", url: window.location.href });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
