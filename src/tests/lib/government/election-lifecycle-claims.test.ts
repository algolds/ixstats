/**
 * MC-2: resolveElection claims an election before counting it, so the cron and the owner's
 * "Count votes" button can never count the same election twice, and releases it when it
 * cannot resolve so a later pass retries.
 */
jest.mock("~/lib/government/election-simulation", () => ({
  simulateElectionCore: jest.fn(),
}));

import { simulateElectionCore } from "~/lib/government/election-simulation";
import { resolveElection, syncElectionCandidates } from "~/lib/government/election-lifecycle";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const simulate = jest.mocked(simulateElectionCore);

describe("resolveElection claim", () => {
  beforeEach(() => simulate.mockReset());

  it("does nothing when another worker already claimed the election", async () => {
    const db = createMockPrisma();
    db.election.updateMany.mockResolvedValue({ count: 0 });

    await expect(resolveElection(db as any, "e1")).resolves.toEqual({ outcome: "not_claimed" });
    expect(db.election.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "upcoming" },
      data: { status: "voting" },
    });
    expect(simulate).not.toHaveBeenCalled();
  });

  it("releases the claim when there are too few candidates", async () => {
    const db = createMockPrisma();
    db.election.updateMany.mockResolvedValue({ count: 1 });
    db.election.findUnique.mockResolvedValue({ id: "e1", countryId: "c1", candidates: [] });
    db.politicalParty.findMany.mockResolvedValue([{ id: "p1", name: "Solo", leaderName: null }]);
    simulate.mockResolvedValue({ ok: false, reason: "insufficient_candidates" });

    await expect(resolveElection(db as any, "e1")).resolves.toEqual({
      outcome: "insufficient_candidates",
    });
    expect(db.election.updateMany).toHaveBeenLastCalledWith({
      where: { id: "e1", status: "voting" },
      data: { status: "upcoming" },
    });
    expect(db.election.create).not.toHaveBeenCalled();
  });

  it("releases the claim and rethrows when the count fails", async () => {
    const db = createMockPrisma();
    db.election.updateMany.mockResolvedValue({ count: 1 });
    simulate.mockRejectedValue(new Error("db down"));

    await expect(resolveElection(db as any, "e1")).rejects.toThrow("db down");
    expect(db.election.updateMany).toHaveBeenLastCalledWith({
      where: { id: "e1", status: "voting" },
      data: { status: "upcoming" },
    });
  });
});

describe("syncElectionCandidates", () => {
  it("adds missing active parties and drops inactive ones", async () => {
    const db = createMockPrisma();
    db.election.findUnique.mockResolvedValue({
      id: "e1",
      countryId: "c1",
      candidates: [{ partyId: "p1" }],
    });
    db.politicalParty.findMany.mockResolvedValue([
      { id: "p1", name: "One", leaderName: "Ana", platform: null },
      { id: "p2", name: "Two", leaderName: "  ", platform: "Growth" },
    ]);

    await expect(syncElectionCandidates(db as any, "e1")).resolves.toBe(2);
    expect(db.electionCandidate.deleteMany).toHaveBeenCalledWith({
      where: { electionId: "e1", partyId: { notIn: ["p1", "p2"] } },
    });
    expect(db.electionCandidate.createMany).toHaveBeenCalledWith({
      data: [{ electionId: "e1", partyId: "p2", candidateName: "Two list", platform: "Growth" }],
    });
  });
});
