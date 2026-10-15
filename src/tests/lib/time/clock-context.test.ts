/** @jest-environment node */
/** Which clock a page greets by: its realm inside realms, real time outside (realm clocks spec §4). */
import fs from "fs";
import path from "path";
import { clockContextForPath, STANDALONE_APP_ROUTES } from "~/lib/time/clock-context";

describe("clockContextForPath", () => {
  it.each([
    ["/r/eurth", null, { kind: "realm", realm: "eurth" }],
    ["/r/eurth/manage", null, { kind: "realm", realm: "eurth" }],
    ["/thinkpages/r/eurth/hub", null, { kind: "realm", realm: "eurth" }],
    ["/thinkpages/r/mine", null, { kind: "realm", active: true }],
    ["/countries/aurelia", null, { kind: "realm", country: "aurelia" }],
    ["/countries", null, { kind: "realm", active: true }],
    ["/mycountry/executive", null, { kind: "realm", active: true }],
    ["/builder", null, { kind: "realm", active: true }],
    ["/maps", "eurth", { kind: "realm", realm: "eurth" }],
    // The map shows the viewer's active realm when the link names none.
    ["/maps", null, { kind: "realm", active: true }],
    ["/vault", null, { kind: "real" }],
    ["/thinkpages", null, { kind: "real" }],
    ["/wiki/Aurelia", null, { kind: "real" }],
    ["/dashboard", null, { kind: "real" }],
    ["/", null, { kind: "real" }],
    ["/something/unknown", null, { kind: "real" }],
  ])("%s (realm=%s)", (path, realm, expected) => {
    expect(clockContextForPath(path, realm)).toEqual(expected);
  });
});

describe("clockContextForPath on the maps host (maps.ixwiki.com)", () => {
  it.each([
    // next.config.js rewrites a root-level slug to that country's page.
    ["/aurelia", { kind: "realm", country: "aurelia" }],
    ["/vault", { kind: "real" }],
    ["/maps", { kind: "realm", active: true }],
    ["/r/eurth", { kind: "realm", realm: "eurth" }],
  ])("%s", (pathname, expected) => {
    expect(clockContextForPath(pathname, null, true)).toEqual(expected);
  });

  it("knows the same app routes as the host's rewrite", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.js"), "utf8");
    const routes = /\/:slug\(\(\?!([^)]*)\)/.exec(config)?.[1] ?? "";
    expect([...STANDALONE_APP_ROUTES].sort()).toEqual(
      routes
        .split("|")
        .map((r) => r.replace(/\\\\\./g, "."))
        .sort()
    );
  });
});
