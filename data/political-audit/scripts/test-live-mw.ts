async function test() {
  try {
    const res = await fetch("https://ixwiki.com/api.php?action=query&meta=siteinfo&siprop=statistics&format=json", {
      headers: { "User-Agent": "IxStats-Builder" },
      signal: AbortSignal.timeout(10000)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Stats:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("Fetch failed:", e.message);
  }
}
test();
