/** @jest-environment node */
jest.mock("~/lib/base-path", () => ({ withBasePath: (path: string) => path }));

import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";

describe("proxyCardArtwork", () => {
  it.each([
    [
      "https://static.wikia.nocookie.net/althistory/images/e/e8/Geraldine-ferraro.jpg/revision/latest?cb=20151117051220",
      "Geraldine-ferraro.jpg",
    ],
    // The name is decoded, then encoded once as one path segment.
    [
      "https://static.wikia.nocookie.net/AltHistory/images/5/5c/Ronaldo_%28cropped%29.jpg/revision/latest",
      "Ronaldo_(cropped).jpg",
    ],
    [
      "https://static.wikia.nocookie.net/althistory/images/a/ab/..\\..\\..\\api\\x",
      "..%5C..%5C..%5Capi%5Cx",
    ],
    [
      "https://vignette.wikia.nocookie.net/althistory/images/a/ab/Elm.png/revision/latest?cb=1",
      "Elm.png",
    ],
    [
      "https://vignette4.wikia.nocookie.net/althistory/images/a/ab/Elm.png/revision/latest",
      "Elm.png",
    ],
    [
      "https://img1.wikia.nocookie.net/__cb20120101000000/althistory/images/a/ab/Elm.png",
      "Elm.png",
    ],
    ["https://images.wikia.com/althistory/images/a/ab/Elm.png", "Elm.png"],
  ])("sends AltHistory's Fandom CDN file %s through its media proxy by name", (url, name) => {
    expect(proxyCardArtwork(url)).toBe(`/api/mediawiki/althistory/wiki/Special:FilePath/${name}`);
  });

  it.each([
    // Another Fandom wiki: the proxy only knows AltHistory.
    "https://static.wikia.nocookie.net/starwars/images/a/ab/X.png",
    // Hosts that only look like Fandom's CDN.
    "https://static.wikia.nocookie.net.attacker.com/althistory/images/a/ab/X.png",
    "https://static.wikia.nocookie.net@attacker.com/althistory/images/a/ab/X.png",
    "https://static.wikia.nocookie.net\\@attacker.com/althistory/images/a/ab/X.png",
    "https://evil-static.wikia.nocookie.net/althistory/images/a/ab/X.png",
    "https://static.wikia.nocookie.net:444/althistory/images/a/ab/X.png",
    // A path step is never sent to the proxy.
    "https://img1.wikia.nocookie.net/__cb1/althistory/images/a/ab/%2e%2e",
    "https://static.wikia.nocookie.net/althistory/images/a/ab/..",
  ])("leaves %s alone", (url) => {
    expect(proxyCardArtwork(url)).toBe(url);
  });

  it("sends Commons uploads, original or thumbnail, through the Commons media proxy by name", () => {
    expect(
      proxyCardArtwork(
        "https://upload.wikimedia.org/wikipedia/commons/9/91/Acrocanthosaurus_skeleton_%281%29.jpg?utm_source=commons.wikimedia.org"
      )
    ).toBe("/api/mediawiki/commons/wiki/Special:FilePath/Acrocanthosaurus_skeleton_(1).jpg");
    expect(
      proxyCardArtwork(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Flag_of_Ireland.svg/320px-Flag_of_Ireland.svg.png"
      )
    ).toBe("/api/mediawiki/commons/wiki/Special:FilePath/Flag_of_Ireland.svg");
  });

  it("keeps the IIWiki, NationStates and other Wikimedia routes", () => {
    expect(proxyCardArtwork("https://iiwiki.com/images/a/ab/Elm.png")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Elm.png"
    );
    for (const url of [
      "https://www.nationstates.net/images/cards/s3/x.jpg",
      "https://upload.wikimedia.org/wikipedia/en/4/45/Not_on_Commons.png",
      // A path step names no Commons file, so it never reaches Special:FilePath.
      "https://upload.wikimedia.org/wikipedia/commons/4/45/File:..",
      "https://upload.wikimedia.org/wikipedia/commons/4/45/File:%2e%2e",
    ]) {
      expect(proxyCardArtwork(url)).toBe(`/api/proxy-ns-image?url=${encodeURIComponent(url)}`);
    }
  });
});
