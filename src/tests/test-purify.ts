import { sanitizeUserContent } from "../../src/lib/sanitize-html";

const sampleEmbed = `
<div data-wikiembed="true" data-title="Sample Article" data-summary="This is a summary of the article." data-imageurl="https://ixwiki.com/image.png" data-source="ixwiki" class="my-3 select-none">
  <div class="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5 mb-1 select-none">
        <span class="text-[10px]">IxWiki Article</span>
      </div>
      <h4 class="text-sm font-semibold">Sample Article</h4>
      <p class="text-xs">This is a summary of the article.</p>
    </div>
  </div>
</div>
`;

console.log("Original HTML length:", sampleEmbed.trim().length);
const sanitized = sanitizeUserContent(sampleEmbed);
console.log("Sanitized HTML:");
console.log(sanitized);
console.log("Does it contain data-wikiembed?", sanitized.includes("data-wikiembed"));
console.log("Does it contain data-title?", sanitized.includes("data-title"));
