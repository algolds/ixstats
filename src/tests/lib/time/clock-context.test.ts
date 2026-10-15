/** @jest-environment node */
/** Which clock a page greets by: its realm inside realms, real time outside (realm clocks spec §4). */
import { clockContextForPath } from "~/lib/time/clock-context";

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
    ["/maps", null, { kind: "realm", realm: "ixnay" }],
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
