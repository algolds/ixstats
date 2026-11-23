import { formatLatLng, mapViewLink } from "./map-view-link";

it("links the view, keeping the realm and dropping a picked country", () => {
  const link = mapViewLink("https://x.test/maps?realm=eurth&country=c1&name=Caph&layer=climate", {
    lng: -12.345678,
    lat: 40.5,
    zoom: 5.256,
    layers: ["background", "political", "rivers"],
  });
  const params = new URL(link).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    realm: "eurth",
    lat: "40.5000",
    lng: "-12.3457",
    zoom: "5.26",
    layers: "political,rivers",
  });
});

it("carries a tilted camera, and drops a flat one", () => {
  const tilted = new URL(
    mapViewLink("https://x.test/maps?pitch=30", {
      lng: 0,
      lat: 0,
      zoom: 5,
      pitch: 44.6,
      bearing: -12.2,
    })
  ).searchParams;
  expect([tilted.get("pitch"), tilted.get("bearing")]).toEqual(["45", "-12"]);
  const flat = new URL(mapViewLink("https://x.test/maps?pitch=30", { lng: 0, lat: 0, zoom: 5 }))
    .searchParams;
  expect(flat.has("pitch")).toBe(false);
});

it("drops an old layers list when no layer shows", () => {
  const link = mapViewLink("https://x.test/maps?layers=climate", {
    lng: 0,
    lat: 0,
    zoom: 1,
    layers: [],
  });
  expect(new URL(link).searchParams.has("layers")).toBe(false);
});

it("writes hemispheres instead of signs", () => {
  expect(formatLatLng(-45.5, -12.25)).toBe("12.2500° S, 45.5000° W");
});
