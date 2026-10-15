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

const DIVIDEND = {
  day: "2026-10-13",
  lines: [
    { key: "interest", amount: 12, detail: { deckValue: 4800, rate: 0.0025 } },
    { key: "streak", amount: 3, detail: { days: 3, activity: 20, step: 0.05 } },
  ],
  inputs: {
    deckValue: 4800,
    wikiScore: 0,
    posts: 0,
    packsOpened: 0,
    tradesCompleted: 0,
    listingsSold: 0,
    streakDays: 3,
    yieldBoost: 0,
  },
};

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

  it("lays rows out compactly: a 24px icon, the amount and the balance as right-aligned columns", () => {
    pages = () => ({
      transactions: [tx("a", { credits: 15, balanceAfter: 1015, source: "DAILY_LOGIN_CREDITS" })],
      hasMore: false,
    });
    const { container } = render(<VaultStatement />);
    const item = container.querySelector("[data-row]") as HTMLElement;
    const icon = item.querySelector('[data-slot="statement-icon"]') as HTMLElement;
    expect(icon.className).toContain("size-6");
    expect(icon.className).toContain("bg-tint-fill");
    expect(icon.querySelector(".facet-texture-dots")).not.toBeNull();
    // The row itself carries no texture.
    expect(item.querySelectorAll(".texture-overlay")).toHaveLength(1);
    expect(item.querySelector(".min-h-9")).not.toBeNull();
    const title = within(item).getByText("Daily reward");
    expect(title.className).not.toMatch(/font-semibold|text-headline/);
    expect(title.parentElement!.className).toContain("text-callout");
    const amount = within(item).getByText(/^\+/);
    expect(amount.className).toContain("text-success-ink");
    expect(amount.className).toContain("text-right");
    const balance = item.querySelector('[data-slot="statement-balance"]') as HTMLElement;
    expect(balance.textContent).toBe("1,015");
    expect(balance.className).toContain("text-right");
    expect(balance.className).toContain("text-label-secondary");
  });

  it("formats amounts and balances alike: whole numbers, or exactly two decimals with cents", () => {
    pages = () => ({
      transactions: [
        tx("a", { credits: 7.55, balanceAfter: 7122.85 }),
        tx("b", { credits: 100, balanceAfter: 6515.3 }),
        tx("c", { credits: -1250, balanceAfter: 1234567 }),
      ],
      hasMore: false,
    });
    const { container } = render(<VaultStatement />);
    const rows = Array.from(container.querySelectorAll("[data-row]"));
    const balances = rows.map(
      (row) => row.querySelector('[data-slot="statement-balance"]')!.textContent
    );
    expect(balances).toEqual(["7,122.85", "6,515.30", "1,234,567"]);
    expect(rows[0]!.textContent).toContain("+7.55");
    expect(rows[1]!.textContent).toContain("+100");
    expect(rows[2]!.textContent).toContain("-1,250");
  });

  it("stacks the balance under the amount on phones and gives it its own column from sm", () => {
    pages = () => ({
      transactions: [tx("a", { credits: 15, balanceAfter: 1015 })],
      hasMore: false,
    });
    const { container } = render(<VaultStatement />);
    const balance = container.querySelector('[data-slot="statement-balance"]') as HTMLElement;
    const group = balance.parentElement!;
    expect(group.className).toMatch(/\bflex-col\b/);
    expect(group.className).toContain("items-end");
    expect(group.className).toContain("sm:flex-row");
    expect(group.contains(within(group).getByText(/^\+/))).toBe(true);
    expect(balance.className).toContain("text-right");
    expect(balance.className).toContain("sm:w-24");
    expect(balance.className).not.toMatch(/(^|\s)w-\d/);
  });

  it("puts a row's detail inline after its title, as secondary text", () => {
    pages = () => ({
      transactions: [
        tx("l", {
          source: "bonus:loreward:e1",
          metadata: JSON.stringify({
            type: "daily",
            place: "winner",
            page: "Ixnay",
            date: "2026-10-15",
          }),
        }),
      ],
      hasMore: false,
    });
    const { container } = render(<VaultStatement />);
    const detail = within(container.querySelector("[data-row]") as HTMLElement).getByText(
      "Ixnay on 2026-10-15"
    );
    expect(detail.tagName).toBe("SPAN");
    expect(detail.className).toContain("text-label-secondary");
    expect(detail.parentElement!.className).toContain("min-w-0");
  });

  it("marks each row with an icon for where the credits came from", () => {
    pages = () => ({
      transactions: [
        tx("a", { source: "VAULT_DIVIDEND", metadata: JSON.stringify(DIVIDEND) }),
        tx("b", { source: "DAILY_LOGIN_CREDITS" }),
        tx("c", { source: "bonus:achievement:first_post" }),
        tx("d", { source: "PACK_PURCHASE", credits: -750 }),
        tx("e", { source: "SOCIAL_POST" }),
      ],
      hasMore: false,
    });
    const { container } = render(<VaultStatement />);
    const icons = Array.from(container.querySelectorAll('[data-slot="statement-icon"]'));
    expect(icons.map((icon) => icon.getAttribute("data-icon"))).toEqual([
      "dividend",
      "daily",
      "achievement",
      "pack",
      "other",
    ]);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.querySelector("svg")).not.toBeNull();
      expect(icon.className).toMatch(/text-tint/);
    }
  });

  it("shows ten rows at first and asks the ledger for ten", () => {
    pages = (input) => ({
      transactions: Array.from({ length: input.limit }, (_, i) => tx(`r${i}`)),
      hasMore: true,
    });
    const { container } = render(<VaultStatement />);
    expect(queryInputs.at(-1)).toMatchObject({ limit: 10, offset: 0 });
    expect(container.querySelectorAll("[data-row]")).toHaveLength(10);
  });

  it("loads ten more on Show earlier, from the end of what is shown", async () => {
    pages = (input) => ({
      transactions: Array.from({ length: 10 }, (_, i) => tx(`p${input.offset}-${i}`)),
      hasMore: input.offset === 0,
    });
    const { container } = render(<VaultStatement />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show earlier/i }));
    });
    await waitFor(() => expect(container.querySelectorAll("[data-row]")).toHaveLength(20));
    expect(fetchMock).toHaveBeenCalledWith({ limit: 10, offset: 10 });
    expect(screen.queryByRole("button", { name: /show earlier/i })).toBeNull();
  });

  it("says so when the statement is empty", () => {
    render(<VaultStatement />);
    expect(screen.getByText(/no transactions/i)).toBeTruthy();
  });

  it("expands the Vault dividend into its stored lines", () => {
    pages = () => ({
      transactions: [
        tx("d", {
          credits: 15,
          type: "EARN_PASSIVE",
          source: "VAULT_DIVIDEND",
          metadata: JSON.stringify(DIVIDEND),
        }),
      ],
      hasMore: false,
    });
    render(<VaultStatement />);
    expect(screen.queryByText("Collection interest")).toBeNull();
    const toggle = screen.getByRole("button", { name: /breakdown/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const interest = screen.getByText("Collection interest").closest("li") as HTMLElement;
    expect(interest.textContent).toContain("12");
    expect(screen.getByText("Streak bonus")).toBeTruthy();
  });

  it("offers no breakdown for a row without one", () => {
    pages = () => ({ transactions: [tx("a")], hasMore: false });
    render(<VaultStatement />);
    expect(screen.queryByRole("button", { name: /breakdown/i })).toBeNull();
  });

  it("links Loreward and achievement rows", () => {
    pages = () => ({
      transactions: [
        tx("l", {
          source: "bonus:loreward:e1",
          metadata: JSON.stringify({ type: "daily", place: "winner", date: "2026-10-15" }),
        }),
        tx("m", {
          source: "bonus:achievement:first_post",
          metadata: { achievementId: "first_post", achievementName: "First post" },
        }),
      ],
      hasMore: false,
    });
    render(<VaultStatement />);
    expect(screen.getByRole("link", { name: /loreward: daily winner/i }).getAttribute("href")).toBe(
      "/vault/achievements?tab=lorewards"
    );
    expect(
      screen.getByRole("link", { name: /achievement: first post/i }).getAttribute("href")
    ).toBe("/vault/achievements?a=first_post");
  });

  it("filters earned and spent through the query, resetting the loaded rows", async () => {
    pages = () => ({ transactions: [tx("a")], hasMore: false });
    render(<VaultStatement />);
    expect(queryInputs.at(-1)?.direction).toBeUndefined();
    fireEvent.click(screen.getByRole("radio", { name: "Earned" }));
    expect(queryInputs.at(-1)).toMatchObject({ direction: "earned", offset: 0 });
    fireEvent.click(screen.getByRole("radio", { name: "Spent" }));
    expect(queryInputs.at(-1)).toMatchObject({ direction: "spent", offset: 0 });
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(queryInputs.at(-1)?.direction).toBeUndefined();
  });

  it("loads the next page on Show earlier and hides the button at the end", async () => {
    pages = (input) =>
      input.offset === 0
        ? { transactions: [tx("a"), tx("b", { source: "P2P_TRADE" })], hasMore: true }
        : { transactions: [tx("c", { source: "JUNK_CARDS" })], hasMore: false };
    render(<VaultStatement pageSize={2} />);
    expect(queryInputs.at(-1)).toMatchObject({ limit: 2, offset: 0 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show earlier/i }));
    });
    await waitFor(() => expect(screen.getByText("Cards junked")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith({ limit: 2, offset: 2 });
    expect(screen.getByText("Player trade")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show earlier/i })).toBeNull();
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
