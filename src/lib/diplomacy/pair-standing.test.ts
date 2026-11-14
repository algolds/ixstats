import { pairStanding } from "./pair-standing";

const row = (initiatorId: string, targetId: string, actionType: string, status: string) => ({
  initiatorId,
  targetId,
  actionType,
  status,
});

it("reads each act between the two nations from the viewer's side", () => {
  const standing = pairStanding(
    "me",
    "them",
    [
      row("me", "them", "free_trade", "proposed"),
      row("them", "me", "military_alliance", "proposed"),
      row("me", "them", "sanction", "active"),
      // Their embargo on me does not stop mine on them.
      row("them", "me", "embargo", "active"),
      // Another pair entirely.
      row("me", "other", "free_trade", "active"),
    ],
    [{ hostCountryId: "them", guestCountryId: "me" }]
  );
  expect(standing.policy("free_trade")).toBe("proposed");
  expect(standing.policy("military_alliance")).toBe("incoming");
  expect(standing.policy("sanction")).toBe("active");
  expect(standing.policy("embargo")).toBe("open");
  expect(standing.hasEmbassy).toBe(true);
});

it("counts an agreement in force either way round, and only the viewer's own embassy", () => {
  const standing = pairStanding(
    "me",
    "them",
    [row("them", "me", "free_trade", "active")],
    [{ hostCountryId: "me", guestCountryId: "them" }]
  );
  expect(standing.policy("free_trade")).toBe("active");
  expect(standing.hasEmbassy).toBe(false);
});
