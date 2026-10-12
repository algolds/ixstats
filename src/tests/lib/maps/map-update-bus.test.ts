/** @jest-environment node */
/**
 * The map update bus: a server write announces what changed (`changeType`), and in which realm when it knows,
 * so a viewer's live sync can ignore other realms' edits.
 */
import { broadcastMapUpdate, mapUpdateBus } from "~/lib/maps/map-update-bus";

describe("broadcastMapUpdate", () => {
  it("carries the realm and the change type to every listener", () => {
    const listener = jest.fn();
    const off = mapUpdateBus.subscribe(listener);

    broadcastMapUpdate("bulk", "c1", "r_eurth");
    off();

    expect(listener).toHaveBeenCalledWith({
      type: "map_data_changed",
      changeType: "bulk",
      countryId: "c1",
      realmId: "r_eurth",
      timestamp: expect.any(Number),
    });
  });

  it("leaves the realm out when the writer does not name one", () => {
    const listener = jest.fn();
    const off = mapUpdateBus.subscribe(listener);

    broadcastMapUpdate("poi", "c1");
    off();

    expect(listener.mock.calls[0][0].realmId).toBeUndefined();
  });
});
