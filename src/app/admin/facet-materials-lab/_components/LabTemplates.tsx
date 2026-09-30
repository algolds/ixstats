import * as React from "react";
import { type LabConfig } from "./types";
import { InteractiveCardTemplates } from "./templates/InteractiveCardTemplates";
import { InteractiveActionTemplates } from "./templates/InteractiveActionTemplates";

interface TemplateRendererProps {
  config: LabConfig;
  previewRef: React.RefObject<HTMLDivElement | null>;
  dynamicStyles: React.CSSProperties;
  generatedClassNames: string;
}

const CARD_TEMPLATES = new Set([
  "material-block",
  "facet-card",
  "compounding-stack",
  "enhanced-card",
  "bento-card",
  "progressive-blur",
  "glare-card",
  "cutout-card",
  "comet-card",
  "texture-card",
  "code-block",
]);

export function LabTemplates({
  config,
  previewRef,
  dynamicStyles,
  generatedClassNames,
}: TemplateRendererProps) {
  const { template, customAccent } = config;

  const accentVars = {
    "--facet-lab-accent": customAccent,
    "--accent": customAccent,
  } as React.CSSProperties;

  // Live component states for previews
  const [activeNode, setActiveNode] = React.useState<number | null>(null);
  const [secureStatus, setSecureStatus] = React.useState(true);
  const [linkEstablished, setLinkEstablished] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [activeNav, setActiveNav] = React.useState("Dashboard");
  const [buttonClickCount, setButtonClickCount] = React.useState(0);
  const [glassClickStates, setGlassClickStates] = React.useState<Record<string, boolean>>({});

  const handleLinkClick = () => {
    if (linkEstablished) {
      setLinkEstablished(false);
      return;
    }
    setLinking(true);
    setTimeout(() => {
      setLinking(false);
      setLinkEstablished(true);
    }, 1000);
  };

  if (CARD_TEMPLATES.has(template)) {
    return (
      <InteractiveCardTemplates
        config={config}
        previewRef={previewRef}
        dynamicStyles={dynamicStyles}
        generatedClassNames={generatedClassNames}
        accentVars={accentVars}
        activeNode={activeNode}
        setActiveNode={setActiveNode}
        secureStatus={secureStatus}
        setSecureStatus={setSecureStatus}
        linkEstablished={linkEstablished}
        linking={linking}
        handleLinkClick={handleLinkClick}
        buttonClickCount={buttonClickCount}
        setButtonClickCount={setButtonClickCount}
        glassClickStates={glassClickStates}
        setGlassClickStates={setGlassClickStates}
      />
    );
  }

  return (
    <InteractiveActionTemplates
      config={config}
      previewRef={previewRef}
      dynamicStyles={dynamicStyles}
      generatedClassNames={generatedClassNames}
      accentVars={accentVars}
      activeNav={activeNav}
      setActiveNav={setActiveNav}
      buttonClickCount={buttonClickCount}
      setButtonClickCount={setButtonClickCount}
      glassClickStates={glassClickStates}
      setGlassClickStates={setGlassClickStates}
    />
  );
}
