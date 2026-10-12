/**
 * Live sync's reading of a change event: which realm it belongs to and which of a map's queries it makes stale. The
 * layers are not queries to refresh here: they follow the realm's map version, which a "version" event moves.
 */
import { isForRealm, parseMapSyncEvent, queriesFor } from "~/lib/maps/live-sync";

describe("parseMapSyncEvent", () => {
  it("reads the change type and realm off the stream's JSON, and nothing else", () => {
    const data = JSON.stringify({
      type: "map_data_changed",
      changeType: "poi",
      countryId: "c1",
      realmId: "r_eurth",
      timestamp: 5,
    });

    expect(parseMapSyncEvent(data)).toStrictEqual({ changeType: "poi", realmId: "r_eurth" });
  });

  it("takes a payload it cannot read as an unknown change in every realm", () => {
    expect(parseMapSyncEvent("not json")).toStrictEqual({ changeType: "unknown" });
    expect(parseMapSyncEvent(JSON.stringify({ changeType: 7, realmId: 3 }))).toStrictEqual({
      changeType: "unknown",
    });
  });
});

describe("isForRealm", () => {
  it("is true for the viewer's realm and for a change in every realm", () => {
    expect(isForRealm({ changeType: "city", realmId: "r_a" }, "r_a")).toBe(true);
    expect(isForRealm({ changeType: "city" }, "r_a")).toBe(true);
  });

  it("is false for another realm's change", () => {
    expect(isForRealm({ changeType: "city", realmId: "r_b" }, "r_a")).toBe(false);
  });

  it("is true while the viewer's realm is not known yet", () => {
    expect(isForRealm({ changeType: "city", realmId: "r_b" }, undefined)).toBe(true);
  });
});

describe("queriesFor", () => {
  it("refreshes only the version when a realm's map version moved", () => {
    expect(queriesFor("version")).toEqual(["version"]);
  });

  it("refreshes only what the change touches, plus the open country's own queries", () => {
    expect(queriesFor("storyPin")).toEqual(["storyPins", "country"]);
    expect(queriesFor("mapLabel")).toEqual(["labels", "country"]);
    expect(queriesFor("poi")).toEqual(["markers", "country"]);
    expect(queriesFor("subdivision")).toEqual(["detail", "country"]);
    expect(queriesFor("city")).toEqual(["markers", "detail", "country"]);
  });

  it("refreshes everything for a bulk change and for one it does not know", () => {
    const all = ["version", "markers", "detail", "storyPins", "labels", "country"];
    expect(queriesFor("bulk")).toEqual(all);
    expect(queriesFor("something-new")).toEqual(all);
  });
});
