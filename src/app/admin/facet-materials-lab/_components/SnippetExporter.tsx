import * as React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Code, Check, Copy } from "iconoir-react";
import { type LabConfig } from "./types";

interface SnippetExporterProps {
  config: LabConfig;
  generatedClassNames: string;
}

export function SnippetExporter({ config, generatedClassNames }: SnippetExporterProps) {
  const { texture, textureOpacity, lightInteraction, customAccent } = config;
  const [copied, setCopied] = React.useState<boolean>(false);

  // Generate TSX Snippet code
  const getSnippetCode = () => {
    const styleObj = `{
  ${
    lightInteraction
      ? `"--pointer-x": "50%",
          "--pointer-y": "50%",
          "--pointer-offset-x": "0px",
          "--pointer-offset-y": "0px",`
      : ""
  }
          "--facet-lab-accent": "${customAccent}",
        } as React.CSSProperties`;

    return `import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { TextureOverlay } from "~/components/ui/texture-overlay";

export default function CustomFacetWidget() {
  return (
    <div className="${generatedClassNames}" style={${styleObj}}>
      {/* Physical Backing Pattern Override */}
      <TextureOverlay 
        texture="${texture}" 
        opacity={${textureOpacity}} 
        className="rounded-[inherit] z-0" 
      />
      
      {/* Content wrapper layer */}
      <div className="relative z-10 w-full h-full p-6" 
           style={{ "--accent": "${customAccent}" } as React.CSSProperties}>
        {/* Add custom components/content here */}
      </div>
    </div>
  );
}`;
  };

  // Handle Clipboard Copy
  const copyCodeToClipboard = () => {
    const code = getSnippetCode();
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <FacetCard className="flex flex-col gap-4 p-6">
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Code className="text-tint h-4 w-4" />
          <h3 className="text-headline">TSX code exporter</h3>
        </div>
        <Button variant="outline" size="sm" onClick={copyCodeToClipboard} className="gap-1.5">
          {copied ? <Check className="text-green h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy Code"}</span>
        </Button>
      </div>

      <div className="relative">
        <pre className="bg-fill-3 border-separator text-label rounded-row text-footnote max-h-[280px] overflow-x-auto border p-4 font-mono leading-relaxed">
          <code>{getSnippetCode()}</code>
        </pre>
      </div>
    </FacetCard>
  );
}
