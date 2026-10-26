/**
 * Match revenue reads the ticket price clamped to the MyClub ceiling, and setTicketPrice refuses a price above it.
 *
 * Regression: setTicketPrice took any price of at least 1, and computeMatchRevenue multiplied it straight into the
 * club's budget, so one setting drove a budget toward infinity.
 */
jest.mock("~/lib/vault/exchange-service", () => ({
  __esModule: true,
  exchangeService: { spend: jest.fn(), earn: jest.fn() },
}));

import { describe, it, expect } from "@jest/globals";
import { computeMatchRevenue, MAX_TICKET_PRICE } from "~/lib/sports/match-revenue";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsClubRouter } from "~/server/api/routers/sports/club";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const homeWin = { id: "m1", homeTeamId: "t1", awayTeamId: "t2", homeScore: 2, awayScore: 0 };
const club = (ticketPrice: number) => ({
  id: "t1",
  stadiumCapacity: 5000,
  ticketPrice,
  popularity: 50,
  sponsor: null,
});

describe("computeMatchRevenue", () => {
  it("pays tickets at the stored price up to the ceiling", () => {
    expect(computeMatchRevenue(club(15), [homeWin]).ticketRevenue).toBe(5000 * 15 * 0.6 * 0.5);
    expect(computeMatchRevenue(club(MAX_TICKET_PRICE), [homeWin]).ticketRevenue).toBe(
      5000 * MAX_TICKET_PRICE * 0.6 * 0.5
    );
  });

  it.each([
    ["far above the ceiling", 1e12, 5000 * MAX_TICKET_PRICE * 0.6 * 0.5],
    ["infinite", Number.POSITIVE_INFINITY, 0],
    ["not a number", Number.NaN, 0],
    ["negative", -50, 0],
  ])("clamps a stored price %s", (_name, price, tickets) => {
    const revenue = computeMatchRevenue(club(price), [homeWin]);
    expect(revenue.ticketRevenue).toBe(tickets);
    expect(Number.isFinite(revenue.total)).toBe(true);
  });
});

describe("setTicketPrice", () => {
  function caller() {
    const db = createMockPrisma();
    db.sportTeam.findUnique.mockResolvedValue({ id: "t1", ownerUserId: "db_me" });
    db.sportTeam.update.mockImplementation(async (args: { data: unknown }) => args.data);
    const c = createCallerFactory(sportsClubRouter)(
      createMockRouterContext({
        auth: { userId: "clerk_db_me" },
        user: { id: "db_me", clerkUserId: "clerk_db_me", role: { name: "user", level: 100 } },
        db,
      }) as never
    );
    return { db, c };
  }

  it("refuses a price above the ceiling and stores nothing", async () => {
    const { db, c } = caller();
    await expect(
      c.setTicketPrice({ teamId: "t1", price: MAX_TICKET_PRICE + 1 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.sportTeam.update).not.toHaveBeenCalled();
  });

  it("stores a price within it", async () => {
    const { db, c } = caller();
    await c.setTicketPrice({ teamId: "t1", price: MAX_TICKET_PRICE });
    expect(db.sportTeam.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { ticketPrice: MAX_TICKET_PRICE },
    });
  });
});
