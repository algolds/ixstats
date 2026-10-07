import { resultsByParty } from "./useCountryProfileLayer";

jest.mock("~/trpc/react", () => ({ api: {} }));

test("merges a party's candidates into one row, most seats first", () => {
  const row = (partyId: string, seatsWon: number, votePercentage: number) => ({
    partyId,
    partyName: partyId,
    color: "#000",
    votePercentage,
    seatsWon,
  });
  expect(resultsByParty([row("a", 3, 10), row("b", 5, 30), row("a", 4, 20)])).toEqual([
    { partyName: "a", color: "#000", votePercentage: 30, seatsWon: 7 },
    { partyName: "b", color: "#000", votePercentage: 30, seatsWon: 5 },
  ]);
});
