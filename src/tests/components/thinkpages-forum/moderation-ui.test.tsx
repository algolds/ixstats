import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockAppeal = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ thinkpagesForum: { myStanding: { invalidate: jest.fn() } } }),
    thinkpagesForum: {
      appeal: { useMutation: () => ({ mutateAsync: mockAppeal, isPending: false }) },
    },
  },
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/thinkpages/t/t1",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { useNotify: () => notify };
});

import { BanNotice } from "~/components/thinkpages-forum/BanNotice";
import { StandingPanel } from "~/components/thinkpages-forum/StandingPanel";

/** A stored reason or notice a moderator typed, which must never become markup. */
const XSS = '<img src=x onerror="alert(1)">';

describe("ban notices", () => {
  it("renders a stored notice as text, never as markup", () => {
    const { container } = render(<BanNotice notice={`Banned: ${XSS}`} />);
    expect(screen.getByText(`Banned: ${XSS}`)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
describe("standing", () => {
  const standing = {
    activePoints: 2,
    warnings: [
      {
        id: "w1",
        points: 2,
        reason: XSS,
        createdAt: new Date("2026-10-01T00:00:00Z"),
        expiresAt: new Date("2026-12-30T00:00:00Z"),
        revokedAt: null,
        appeal: null,
        canAppeal: true,
      },
    ],
    bans: [],
    appeals: [],
  };

  it("lists a warning as text and appeals it", async () => {
    const appeal = mockAppeal.mockResolvedValue({ appealId: "a1" });
    const { container } = render(<StandingPanel standing={standing as never} />);
    const card = container.querySelector("#standing");
    expect(card).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Your standing" })).toBeInTheDocument();
    expect(screen.getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("2 points")).toBeInTheDocument();
    expect(screen.getByText("Expires 30 Dec 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Appeal" }));
    const dialog = screen.getByRole("dialog", { name: "Appeal this warning" });
    const body = "I was quoting the other member, not flaming.";
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: body } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send appeal" }));
    await waitFor(() =>
      expect(appeal).toHaveBeenCalledWith({ subjectType: "warning", subjectId: "w1", body })
    );
  });
});
