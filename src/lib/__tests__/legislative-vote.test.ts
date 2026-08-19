import { tallyVote, type VotingBloc } from "../statecraft/legislative-vote";

const blocs: VotingBloc[] = [
  { partyId: "lab", partyName: "Labour", ideology: "center_left", seats: 180 },
  { partyId: "grn", partyName: "Greens", ideology: "left", seats: 40 },
  { partyId: "con", partyName: "Conservatives", ideology: "center_right", seats: 210 },
];

describe("tallyVote", () => {
  it("passes a left-leaning bill with the left bloc, opposed by the right", () => {
    // bill at center_left (-1): Labour d0 yes, Greens d1 yes, Conservatives d2 abstain
    const r = tallyVote(-1, blocs);
    expect(r.yesSeats).toBe(220);
    expect(r.noSeats).toBe(0);
    expect(r.abstainSeats).toBe(210);
    expect(r.passed).toBe(true);
    expect(r.margin).toBe(220);
  });

  it("fails a far-right bill the larger centre-left bloc rejects", () => {
    // bill at far_right (3): Labour d4 no, Greens d5 no, Conservatives d2 abstain
    const r = tallyVote(3, blocs);
    expect(r.noSeats).toBe(220);
    expect(r.yesSeats).toBe(0);
    expect(r.passed).toBe(false);
  });

  it("treats abstentions as not cast (yes>no wins on a thin margin)", () => {
    const close: VotingBloc[] = [
      { partyId: "a", partyName: "A", ideology: "center", seats: 51 },
      { partyId: "b", partyName: "B", ideology: "far_right", seats: 49 },
    ];
    const r = tallyVote(0, close); // A d0 yes(51), B d3 no(49)
    expect(r.passed).toBe(true);
    expect(r.margin).toBe(2);
  });
});
