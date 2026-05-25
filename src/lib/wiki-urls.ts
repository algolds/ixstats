// Helper to centralize internal wiki/forum hostnames
export function wikiBase(wiki: "ixwiki" | "iiwiki" | "althistory" = "ixwiki") {
  const ix = (process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/").replace(/\/$/, "");
  if (wiki === "ixwiki") return ix;
  if (wiki === "iiwiki")
    return (process.env.NEXT_PUBLIC_IIWIKI_URL || "https://iiwiki.com").replace(/\/$/, "");
  return (process.env.NEXT_PUBLIC_ALTHISTORY_URL || "https://althistory.fandom.com").replace(
    /\/$/,
    ""
  );
}

export function forumBase() {
  return (
    process.env.NEXT_PUBLIC_FORUM_URL ||
    process.env.NEXT_PUBLIC_XENFORO_URL ||
    "https://forum.ixwiki.com"
  ).replace(/\/$/, "");
}
