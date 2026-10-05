import { currentVersionKey, markVersionSeen, readSeenVersion } from "~/lib/navigation/seen-version";
import { APP_VERSION, BUILD_VERSION } from "~/lib/buildVersion";

beforeEach(() => window.localStorage.clear());

describe("seen version", () => {
  it("keys the running build as version+build", () => {
    expect(currentVersionKey()).toBe(`${APP_VERSION}+${BUILD_VERSION}`);
  });

  it("stores the key under the key the old notice used and announces the change", () => {
    const listener = jest.fn();
    window.addEventListener("ixstats:version-seen", listener);
    expect(readSeenVersion()).toBeNull();
    markVersionSeen();
    expect(window.localStorage.getItem("ixstats:version-seen")).toBe(currentVersionKey());
    expect(readSeenVersion()).toBe(currentVersionKey());
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("ixstats:version-seen", listener);
  });

  it("treats the build as seen when storage cannot be read, so New never sticks", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSeenVersion()).toBe(currentVersionKey());
    spy.mockRestore();
  });
});
