import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

interface Tx {
  id: string;
  createdAt: Date;
  credits: number;
  balanceAfter: number;
  type: string;
  source: string;
  metadata: unknown;
}
interface Page {
  transactions: Tx[];
  hasMore: boolean;
}
type Input = { limit: number; offset: number; direction?: "earned" | "spent" };

const NOW = new Date();
const tx = (id: string, over: Partial<Tx> = {}): Tx => ({
  id,
  createdAt: NOW,
  credits: 10,
  balanceAfter: 1000,
  type: "EARN_ACTIVE",
  source: "SOCIAL_POST",
  metadata: null,
  ...over,
});
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    vault: { getTransactions: { useQuery: jest.fn() } },
  },
}));

import { api } from "~/trpc/react";

import { VaultStatement } from "~/components/vault/sections/dashboard/VaultStatement";

let pages: (input: Input) => Page = () => ({ transactions: [], hasMore: false });
const queryInputs: Input[] = [];
const fetchMock = jest.fn(async (input: Input) => pages(input));

describe("VaultStatement", () => {
  beforeEach(() => {
    queryInputs.length = 0;
    fetchMock.mockClear();
    pages = () => ({ transactions: [], hasMore: false });
    jest.mocked(api.useUtils).mockReturnValue({
      vault: { getTransactions: { fetch: fetchMock } },
    } as never);
    jest.mocked(api.vault.getTransactions.useQuery).mockImplementation(((input: Input) => {
      queryInputs.push(input);
      return { data: pages(input), isLoading: false, isError: false };
    }) as never);
  });

  it("renders day-grouped rows with signed amounts and the running balance", () => {
    pages = () => ({
      transactions: [
        tx("a", { credits: 15, balanceAfter: 1015, source: "DAILY_LOGIN_CREDITS" }),
        tx("b", { credits: -40, balanceAfter: 1000, source: "P2P_TRADE", type: "SPEND_OTHER" }),
        tx("c", {
          createdAt: new Date(NOW.getTime() - 86_400_000),
          credits: 5,
          balanceAfter: 1040,
        }),
      ],
      hasMore: false,
    });
    render(<VaultStatement />);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
    const daily = screen.getByText("Daily reward").closest("li") as HTMLElement;
    expect(daily.textContent).toContain("+");
    expect(daily.textContent).toContain("15");
    expect(daily.textContent).toContain("1,015");
    const trade = screen.getByText("Player trade").closest("li") as HTMLElement;
    expect(trade.textContent).toContain("-");
    expect(trade.textContent).toContain("40");
    expect(trade.textContent).toContain("1,000");
  });
  it("drops rows already shown when a later page overlaps", async () => {
    pages = (input) =>
      input.offset === 0
        ? { transactions: [tx("a"), tx("b", { source: "P2P_TRADE" })], hasMore: true }
        : { transactions: [tx("b", { source: "P2P_TRADE" }), tx("c")], hasMore: false };
    render(<VaultStatement pageSize={2} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show earlier/i }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const list = screen.getByText("Today").closest("section") as HTMLElement;
    expect(within(list).getAllByText("Player trade")).toHaveLength(1);
  });

  it("drops a page that arrives after the filter changed", async () => {
    pages = (input) =>
      input.direction === "spent"
        ? { transactions: [tx("s1", { credits: -5, source: "P2P_TRADE" })], hasMore: false }
        : { transactions: [tx("a"), tx("b")], hasMore: true };
    let resolveLate: (page: Page) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Page>((resolve) => (resolveLate = resolve)));
    render(<VaultStatement pageSize={2} />);
    fireEvent.click(screen.getByRole("button", { name: /show earlier/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Spent" }));
    await act(async () => {
      resolveLate({ transactions: [tx("late", { source: "JUNK_CARDS" })], hasMore: true });
    });
    expect(screen.queryByText("Cards junked")).toBeNull();
    expect(screen.getByText("Player trade")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show earlier/i })).toBeNull();
  });
});
