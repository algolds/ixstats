/** @jest-environment node */
/** Pre-Phase 2 takedowns and art move into the queue and licence records; every request is due in 14 days. */
import { legacyTakedownRow, licenceBackfillRow } from "~/lib/cards/compliance-backfill";
import { TAKEDOWN_DEADLINE_DAYS, takedownDueAt } from "~/lib/cards/takedown-deadline";

describe("takedownDueAt", () => {
  it("is 14 days after the request was received", () => {
    expect(TAKEDOWN_DEADLINE_DAYS).toBe(14);
    expect(takedownDueAt(new Date("2026-10-28T09:00:00Z"))).toEqual(
      new Date("2026-11-11T09:00:00Z")
    );
  });
});

describe("legacyTakedownRow", () => {
  it("turns a flag owner's marker into a hidden takedown that restore can bring back from the flag", () => {
    const row = legacyTakedownRow({
      id: "card_ns",
      retiredAt: new Date("2026-09-03T00:00:00Z"),
      metadata: {
        nsTakedown: {
          selfService: true,
          verifiedNation: "Testlandia",
          reason: "My flag",
          hiddenAt: "2026-09-01T00:00:00.000Z",
          hiddenBy: "db_user",
        },
        nsData: { flag: "f.png" },
      },
    });
    expect(row).toEqual({
      cardId: "card_ns",
      origin: "NS_SELF_SERVICE",
      status: "HIDDEN",
      reason: "My flag",
      contact: "NationStates: Testlandia",
      requestedBy: "db_user",
      receivedAt: new Date("2026-09-01T00:00:00.000Z"),
      dueAt: new Date("2026-09-15T00:00:00.000Z"),
      savedArtwork: "f.png",
      retiredByTakedown: true,
      resolvedAt: new Date("2026-09-01T00:00:00.000Z"),
      resolvedBy: "db_user",
    });
  });

  it("makes an admin's marker an admin takedown, dated from the retirement when its own date is unreadable", () => {
    const row = legacyTakedownRow({
      id: "card_ns",
      retiredAt: new Date("2026-09-03T00:00:00Z"),
      metadata: { nsTakedown: { hiddenAt: "not a date", reason: null } },
    });
    expect(row).toMatchObject({
      origin: "ADMIN",
      reason: "Hidden by an admin",
      contact: null,
      requestedBy: null,
      receivedAt: new Date("2026-09-03T00:00:00Z"),
      savedArtwork: null,
    });
  });

  it("is null for a card with no marker, or one a restore cleared", () => {
    expect(legacyTakedownRow({ id: "c", retiredAt: null, metadata: {} })).toBeNull();
    expect(
      legacyTakedownRow({ id: "c", retiredAt: null, metadata: { nsTakedown: null } })
    ).toBeNull();
    expect(legacyTakedownRow({ id: "c", retiredAt: null, metadata: null })).toBeNull();
  });
});

describe("licenceBackfillRow", () => {
  it("records an existing card's art as an unknown licence, naming its file", () => {
    expect(
      licenceBackfillRow({
        id: "c",
        wikiSource: "iiwiki",
        artwork: "https://iiwiki.com/images/a/ab/Elm.png",
      })
    ).toEqual({
      cardId: "c",
      wiki: "iiwiki",
      fileTitle: "File:Elm.png",
      fileUrl: "https://iiwiki.com/images/a/ab/Elm.png",
      status: "UNKNOWN",
      note: "Recorded when Compliance started; not yet checked",
    });
  });

  it("names the Commons file for a wiki card whose art is hosted on Commons", () => {
    expect(
      licenceBackfillRow({
        id: "c",
        wikiSource: "iiwiki",
        artwork: "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg",
      })
    ).toMatchObject({ wiki: "commons", fileTitle: "File:Flag of Ireland.svg" });
  });

  it("keeps an IxWiki card's Commons art on IxWiki, which shows Commons files itself", () => {
    expect(
      licenceBackfillRow({
        id: "c",
        wikiSource: null,
        artwork: "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg",
      })
    ).toMatchObject({ wiki: "ixwiki", fileTitle: "File:Flag of Ireland.svg" });
  });

  it("names no file for art on a host the card's wiki does not serve", () => {
    expect(
      licenceBackfillRow({ id: "c", wikiSource: "iiwiki", artwork: "https://example.com/Elm.png" })
    ).toMatchObject({ wiki: "iiwiki", fileTitle: null, fileUrl: "https://example.com/Elm.png" });
  });

  it("is null without art, or for the site's own placeholder", () => {
    expect(licenceBackfillRow({ id: "c", wikiSource: null, artwork: null })).toBeNull();
    expect(
      licenceBackfillRow({
        id: "c",
        wikiSource: "ixwiki",
        artwork: "/images/cards/lore-placeholder.svg",
      })
    ).toBeNull();
  });
});
