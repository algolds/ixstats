/** @jest-environment node */
/**
 * The live-sync stream: every map change the server announces reaches the viewer as a `map_data_changed` event that
 * names the realm it happened in, so a map open on another realm can ignore it.
 */
jest.mock("~/server/db", () => ({ db: { country: { findUnique: jest.fn() } } }));

import { GET } from "~/app/api/sse/map-updates/route";
import { broadcastMapUpdate, mapUpdateBus } from "~/lib/maps/map-update-bus";
import { db } from "~/server/db";

const findUnique = db.country.findUnique as jest.Mock;

const decoder = new TextDecoder();

async function openStream() {
  const abort = new AbortController();
  const response = await GET(
    new Request("http://localhost/api/sse/map-updates", { signal: abort.signal })
  );
  const reader = response.body!.getReader();
  const next = async () => decoder.decode((await reader.read()).value);
  await next(); // the `connected` greeting
  return { next, close: () => abort.abort() };
}

const dataOf = (chunk: string) => JSON.parse(chunk.split("data: ")[1]!) as Record<string, unknown>;

beforeEach(() => findUnique.mockReset());

describe("GET /api/sse/map-updates", () => {
  it("passes a change on with the realm its writer named", async () => {
    const stream = await openStream();

    broadcastMapUpdate("bulk", undefined, "r_eurth");

    const chunk = await stream.next();
    stream.close();
    expect(chunk).toContain("event: map_data_changed");
    expect(dataOf(chunk)).toMatchObject({ changeType: "bulk", realmId: "r_eurth" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("names the country's realm when the writer named only the country", async () => {
    findUnique.mockResolvedValue({ realmId: "r_other" });
    const stream = await openStream();

    broadcastMapUpdate("poi", "c-route-1");

    const chunk = await stream.next();
    stream.close();
    expect(dataOf(chunk)).toMatchObject({
      changeType: "poi",
      countryId: "c-route-1",
      realmId: "r_other",
    });
  });

  it("logs an event it cannot relay and goes on with the next one", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const stream = await openStream();

    // A BigInt cannot be serialised, so relaying this event throws after the realm lookup
    mapUpdateBus.emit({ type: "map_data_changed", changeType: "poi", timestamp: 1n as never });
    broadcastMapUpdate("bulk", undefined, "r_eurth");

    const chunk = await stream.next();
    stream.close();
    expect(dataOf(chunk)).toMatchObject({ changeType: "bulk", realmId: "r_eurth" });
    expect(error).toHaveBeenCalledWith("[map-updates] relay failed:", expect.any(Error));
    error.mockRestore();
  });
});
