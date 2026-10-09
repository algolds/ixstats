import React from "react";
import { render } from "@testing-library/react";

interface ImageNodeProps {
  children: React.ReactNode;
  element: { src: string; alt?: string };
  attributes: Record<string, string>;
}
interface PluginConfig {
  key: string;
  render?: { node?: (props: ImageNodeProps) => React.ReactElement };
}

// The plugins' own configs are all this test needs: it renders the image plugin's node renderer.
jest.mock("platejs/react", () => {
  const configs: PluginConfig[] = [];
  return {
    configs,
    createPlatePlugin: (config: PluginConfig) => {
      configs.push(config);
      return config;
    },
  };
});

import "~/components/shared/editor/EditorPlugins";

const { configs } = jest.requireMock<{ configs: PluginConfig[] }>("platejs/react");

const renderImage = (src: string) => {
  const node = configs.find((c) => c.key === "img")?.render?.node;
  if (!node) throw new Error("ImagePlugin has no node renderer");
  const { container } = render(node({ children: null, element: { src }, attributes: {} }));
  return container.querySelector("img")?.getAttribute("src");
};

describe("ImagePlugin", () => {
  const saved = process.env.NEXT_PUBLIC_BASE_PATH;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    window.history.pushState({}, "", "/projects/ixstates/thinkpages/forum");
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = saved;
    window.history.pushState({}, "", "/");
  });

  it("previews an uploaded image under the deployment's base path", () => {
    expect(renderImage("/images/uploads/a.png")).toBe("/projects/ixstates/images/uploads/a.png");
  });

  it("leaves absolute and already prefixed sources alone", () => {
    expect(renderImage("https://e.com/a.png")).toBe("https://e.com/a.png");
    expect(renderImage("/projects/ixstates/images/downloaded/x.png")).toBe(
      "/projects/ixstates/images/downloaded/x.png"
    );
  });
});
