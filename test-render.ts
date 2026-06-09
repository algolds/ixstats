import { transformArticleHtml, stripConflictingStyles } from "./src/lib/wikios/html-transformer";

function injectPlaceholderElements(html: string): string {
  let processed = html;

  // 1. Process Coords anchors e.g. <a href="...Coords:lat,lng,zoom...">Label</a>
  processed = processed.replace(
    /<a[^>]*href="[^"]*Coords:([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, coordsStr, label) => {
      const decoded = decodeURIComponent(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      return `<span class="wikios-coords-placeholder" data-lat="${lat || "0"}" data-lng="${lng || "0"}" data-zoom="${zoom || "4"}" data-label="${label || "Location"}">${label || "Location"}</span>`;
    }
  );

  // 2. Process raw Coords wikitext e.g. [[Coords:lat,lng,zoom|Label]]
  processed = processed.replace(
    /\[\[Coords:([^\]|]+)(?:\|([^\]]+))?\]\]/gi,
    (match, coordsStr, label) => {
      const decoded = decodeURIComponent(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const cleanLabel = label || "Location";
      return `<span class="wikios-coords-placeholder" data-lat="${lat || "0"}" data-lng="${lng || "0"}" data-zoom="${zoom || "4"}" data-label="${cleanLabel}">${cleanLabel}</span>`;
    }
  );

  // 3. Process MapEmbed anchors e.g. <a href="...MapEmbed:lat,lng,zoom...">options</a>
  processed = processed.replace(
    /<a[^>]*href="[^"]*MapEmbed:([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, coordsStr, options) => {
      const decoded = decodeURIComponent(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      return `<div class="wikios-map-embed-placeholder" data-lat="${lat || "0"}" data-lng="${lng || "0"}" data-zoom="${zoom || "4"}" data-options="${options || ""}"></div>`;
    }
  );

  // 4. Process raw MapEmbed wikitext e.g. [[MapEmbed:lat,lng,zoom|options]]
  processed = processed.replace(
    /\[\[MapEmbed:([^\]|]+)(?:\|([^\]]+))?\]\]/gi,
    (match, coordsStr, options) => {
      const decoded = decodeURIComponent(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      return `<div class="wikios-map-embed-placeholder" data-lat="${lat || "0"}" data-lng="${lng || "0"}" data-zoom="${zoom || "4"}" data-options="${options || ""}"></div>`;
    }
  );

  // 5. Process Template stats anchors e.g. <a href="...Template:MyCountry:field...">
  processed = processed.replace(
    /<a[^>]*href="[^"]*Template:([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, templateName, label) => {
      const decoded = decodeURIComponent(templateName);
      if (
        decoded.startsWith("MyCountry:") ||
        decoded.startsWith("CountryData:") ||
        decoded.startsWith("BusinessData:")
      ) {
        return `<span class="wikios-stat-placeholder" data-key="${decoded}"></span>`;
      }
      return match;
    }
  );

  // 6. Process raw wikitext templates e.g. {{MyCountry:field}}
  processed = processed.replace(
    /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi,
    (match, key) => {
      return `<span class="wikios-stat-placeholder" data-key="${key}"></span>`;
    }
  );

  return processed;
}

async function testRender() {
  const wikitext = `
[[Coords:-20.25263,30.30697,5|Chido]]
{{CountryData:Algosh Republic:population}}
`;
  console.log("Rendering wikitext via MediaWiki action=parse proxy...");
  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "parse",
      text: wikitext,
      contentmodel: "wikitext",
      prop: "text",
      disablelimitreport: "1",
      disableeditsection: "1",
      wrapoutputclass: "",
      formatversion: "2",
      format: "json",
    }),
  });

  const data = await response.json();
  const rawHtml = data.parse?.text ?? "";
  console.log("\n--- Raw MediaWiki Parsed HTML ---");
  console.log(rawHtml);

  const transformed = transformArticleHtml(stripConflictingStyles(rawHtml), "", "ixwiki");
  console.log("\n--- Transformed HTML ---");
  console.log(transformed.contentHtml);

  const injected = injectPlaceholderElements(transformed.contentHtml);
  console.log("\n--- Injected Placeholder HTML ---");
  console.log(injected);
}

testRender();
