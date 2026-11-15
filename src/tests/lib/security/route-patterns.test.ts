import { isProtectedPath, isPublicPath } from "~/lib/security/route-patterns";

// The rules Clerk's createRouteMatcher applied (checked path for path against it on 2026-11-11, before its removal).
describe("route patterns", () => {
  it.each([
    "/admin",
    "/ADMIN",
    "/administrator",
    "/settings/x",
    "/mycountry/economy",
    "/dashboard",
    "/dashboard/accounts",
    "/vault/cards/mine",
    "/util/lorewards",
    "/blurbs/submit",
    "/blurbs/mine/2",
  ])("sends %s to sign-in", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/countries/caphiria",
    "/r/ixnay",
    "/blurbs",
    "/util/other",
    "/help",
    "/wiki/Main_Page",
  ])("does not protect %s", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });

  it.each([
    "/",
    "/sign-in/sso-callback",
    "/identity",
    "/@kir",
    "/api/trpc/x",
    "/apix",
    "/r/",
    "/countries",
    "/countries/",
    "/MAPS",
    "/exchange/bonds",
    "/dashboard/post/1",
    "/Dashboard/Post/1",
    "/ixeconomy.xlsx",
  ])("lets %s through", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/countriesx", "/mapsx", "/r", "/dashboard/post", "/dashboard", "/help"])(
    "does not make %s public",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    }
  );
});
