import { tallyVote, type VotingBloc } from "~/lib/statecraft/legislative-vote";
import { fogVoteProjection } from "~/lib/statecraft/whip";

const blocs: VotingBloc[] = [
  { partyId: "a", partyName: "Left", ideology: "left", seats: 40 },
  { partyId: "b", partyName: "Centre", ideology: "center", seats: 30 }, // abstains on a left bill
  { partyId: "c", partyName: "Right", ideology: "right", seats: 30 },
];

describe("tallyVote — Mandate whip (S3.B)", () => {
  const leftBill = -2;

  it("is unchanged when no backing is passed (back-compat)", () => {
    const r = tallyVote(leftBill, blocs);
    // left (40) yes; centre (dist 2) abstain; right (dist 4) no
    expect(r.yesSeats).toBe(40);
    expect(r.abstainSeats).toBe(30);
    expect(r.noSeats).toBe(30);
    expect(r.passed).toBe(true);
  });

  it("high backing whips abstainers to yes (more decisive)", () => {
    const low = tallyVote(leftBill, blocs, 0);
    const high = tallyVote(leftBill, blocs, 1);
    expect(high.yesSeats).toBeGreaterThan(low.yesSeats);
    expect(high.abstainSeats).toBeLessThan(low.abstainSeats);
  });
});

describe("fogVoteProjection — standing gates precision (S3.A)", () => {
  const result = tallyVote(-2, blocs);

  it("strong standing reveals exact counts", () => {
    const w = fogVoteProjection(result, 75);
    expect(w.level).toBe("revealed");
    expect(w.yesSeats).toBe(result.yesSeats);
    expect(w.verdict).toBe("pass");
  });

  it("middling standing gives direction but hides seats (never fabricates)", () => {
    const w = fogVoteProjection(result, 45);
    expect(w.level).toBe("questioned");
    expect(w.yesSeats).toBeUndefined();
    expect(["leaning_pass", "too_close"]).toContain(w.verdict);
  });

  it("weak standing reads nothing", () => {
    const w = fogVoteProjection(result, 20);
    expect(w.level).toBe("greyed");
    expect(w.verdict).toBe("unknown");
  });
});
