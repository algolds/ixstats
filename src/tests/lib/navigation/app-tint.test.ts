/** The canvas tint a page wears: its app's, except the Exchange and a nation's profile. */
import { getTintForPath } from "~/lib/navigation/app-sections";

it("wears its app's tint", () => {
  expect(getTintForPath("/mycountry")).toBe("mycountry");
  expect(getTintForPath("/realms")).toBe("realms");
  expect(getTintForPath("/r/ixnay/nations")).toBe("realms");
});

it("gives the Exchange its own tint inside Labs", () => {
  expect(getTintForPath("/exchange/markets")).toBe("exchange");
});

it("puts a nation's profile in the passport's ink, not the Realms purpure", () => {
  expect(getTintForPath("/countries/alcairet")).toBeUndefined();
  expect(getTintForPath("/countries/alcairet/factbook/economy")).toBeUndefined();
  expect(getTintForPath("/id/someone")).toBeUndefined();
  // The bare /countries address redirects to the viewer's realm, which is Realms.
  expect(getTintForPath("/countries")).toBe("realms");
});
