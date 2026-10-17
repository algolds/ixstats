/** @jest-environment node */
jest.mock("~/lib/base-path", () => ({ withBasePath: (path: string) => path }));

import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";

describe("proxyCardArtwork", () => {
  it("sends an AltHistory Fandom CDN file through the AltHistory media proxy by name", () => {
    expect(
      proxyCardArtwork(
        "https://static.wikia.nocookie.net/althistory/images/e/e8/Geraldine-ferraro.jpg/revision/latest?cb=20151117051220"
      )
    ).toBe("/api/mediawiki/althistory/wiki/Special:FilePath/Geraldine-ferraro.jpg");
    // The name stays percent-encoded, as it came.
    expect(
      proxyCardArtwork(
        "https://static.wikia.nocookie.net/AltHistory/images/5/5c/Ronaldo_%28cropped%29.jpg/revision/latest"
      )
    ).toBe("/api/mediawiki/althistory/wiki/Special:FilePath/Ronaldo_%28cropped%29.jpg");
  });

  it("leaves another Fandom wiki's files alone (the proxy only knows AltHistory)", () => {
    const url = "https://static.wikia.nocookie.net/starwars/images/a/ab/X.png";
    expect(proxyCardArtwork(url)).toBe(url);
  });

  it("keeps the IIWiki and NationStates routes", () => {
    expect(proxyCardArtwork("https://iiwiki.com/images/a/ab/Elm.png")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Elm.png"
    );
    expect(proxyCardArtwork("https://www.nationstates.net/images/cards/s3/x.jpg")).toBe(
      `/api/proxy-ns-image?url=${encodeURIComponent("https://www.nationstates.net/images/cards/s3/x.jpg")}`
    );
  });
});
