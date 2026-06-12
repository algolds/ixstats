import { createPlateEditor, ParagraphPlugin } from "platejs/react";
import { serializeHtml } from "platejs/static";

async function main() {
  const editor = createPlateEditor({
    plugins: [ParagraphPlugin],
    value: [{ type: "p", children: [{ text: "Hello World!" }] }],
  });

  const html = serializeHtml(editor);
  console.log("HTML:", html);
}

main().catch(console.error);
