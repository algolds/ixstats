// Renders Facet's lens displacement map to public/images/facet-lens-map.png (128px), the image the
// #facet-lens filter reads (LensFilter.tsx). The SVG below is its source: red runs left to right,
// green top to bottom, and a blurred mid-grey card leaves the middle unbent. A PNG so the browser
// decodes it once instead of rasterising the SVG (and its blur) for every lens.
// usage: PW_CORE=node_modules/playwright-core node scripts/design/render-lens-map.mjs
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ?? "playwright-core");
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
  '<defs><linearGradient id="r" x2="1"><stop stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>' +
  '<linearGradient id="g" x2="0" y2="1"><stop stop-color="#000"/><stop offset="1" stop-color="#0f0"/></linearGradient>' +
  '<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs>' +
  '<rect width="100" height="100" fill="url(#r)"/>' +
  '<rect width="100" height="100" fill="url(#g)" style="mix-blend-mode:screen"/>' +
  '<rect x="8" y="12" width="84" height="76" rx="18" fill="#808080" filter="url(#b)"/></svg>';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const page = await browser.newPage();
const url = await page.evaluate(async (svg) => {
  const img = new Image(); img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await img.decode();
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, 128, 128);
  return c.toDataURL("image/png");
}, svg);
writeFileSync("public/images/facet-lens-map.png", Buffer.from(url.split(",")[1], "base64"));
await browser.close();
