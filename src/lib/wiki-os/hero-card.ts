/**
 * What the reader's hero card is made from, besides the article itself: the parent categories (its
 * breadcrumb), the awards (its badge) and, for a title that names a country, that country (its flag
 * backdrop, its shape and the page's colours). The server reads all three before it renders the page
 * and the client asks for them with the very inputs built here, so the hydrated cache answers the
 * client and the card has its final shape in the first HTML. (Asked for after hydration, they grew
 * the card twice and changed its backdrop and its shape under the reader.)
 */

/** A plain article title that may name a country: not empty, not the Main Page, no namespace. */
export function mayNameCountry(title: string): boolean {
  return (
    title.trim() !== "" && title !== "Main Page" && title !== "Main_Page" && !title.includes(":")
  );
}

/** The inputs of the hero card's reads, one object per read. */
export function heroCardInputs(title: string) {
  return {
    parentCategories: { title },
    awards: { title },
    country: { id: title },
  };
}
