/**
 * A player with no nation is sent to /setup from most pages, but never from the founding flow: /setup's own
 * button leads to /builder, and a reload (or resuming a draft in a new tab) mid-founding must stay on the step.
 */
import { shouldSkipSetup } from "~/app/_components/SetupRedirect";

it.each(["/builder", "/builder/", "/mycountry/welcome"])(
  "keeps %p out of the setup redirect",
  (path) => {
    expect(shouldSkipSetup(path)).toBe(true);
  }
);

it("still sends a nation-less player from MyCountry to setup", () => {
  expect(shouldSkipSetup("/mycountry")).toBe(false);
  expect(shouldSkipSetup(null)).toBe(false);
});
