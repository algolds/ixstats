interface Step {
  title: string;
  short_description: string;
  full_description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  media?: {
    type: "image" | "video";
    src: string;
    alt?: string;
  };
}

export const builderTutorialSteps: Step[] = [
  {
    title: "MyCountry Builder",
    short_description: "Create a country in four steps",
    full_description:
      "You choose a foundation, set your national identity, build a government from components and tune the economy. The figures update as you edit.",
  },
  {
    title: "Foundation",
    short_description: "Choose a starting point",
    full_description:
      "Start from a real country, an archetype, a blank country or an IIWiki import. A real country supplies its GDP, population and growth rate.\n\nTip: pick a country with an economy similar to the one you want, so you have less to change.",
  },
  {
    title: "Identity and core indicators",
    short_description: "Name, symbols and the basic numbers",
    full_description:
      "Set the country name, symbols, population, GDP per capita and growth rate. Related figures are calculated from these.\n\nTip: start with realistic numbers. The fields show the valid range.",
  },
  {
    title: "Government",
    short_description: "Build the government from components",
    full_description:
      "Pick up to 15 components. Each has its own effects, costs and synergies.\n\nTip: set how power is distributed and how decisions are made first, then add institutions.",
  },
  {
    title: "Economics",
    short_description: "Sectors, taxes, labor and demographics",
    full_description:
      "Set the sector mix, trade, tax policy and demographics. The economic health indicators update as you change them.\n\nTip: a mix of sectors is more resilient than a single dominant one.",
  },
  {
    title: "Preview and create",
    short_description: "Review the nation and create it",
    full_description:
      "Check the economic indicators, government structure and overall health. When you create the nation, it appears in MyCountry.",
    action: {
      label: "Done",
      onClick: () => {}, // Will be set by parent component
    },
  },
];

export const quickStartSteps: Step[] = [
  {
    title: "Quick start",
    short_description: "Three steps to a working country",
    full_description:
      "This covers the essentials: core indicators and a basic government. You can add detail later.",
  },
  {
    title: "Step 1: Core indicators",
    short_description: "Country name and key figures",
    full_description:
      "Set the country name, population, GDP per capita and growth rate. Related figures are calculated from these.\n\nTip: the fields show the valid range.",
  },
  {
    title: "Step 2: Basic government",
    short_description: "Choose the main components",
    full_description:
      "Pick components for how power is distributed, how decisions are made and the judiciary. You can add more later.",
  },
  {
    title: "Step 3: Preview and create",
    short_description: "Review the nation and create it",
    full_description:
      "Check that the economic health indicators are green, review the summary, then create the nation. You can come back to the builder and change it at any time.",
    action: {
      label: "Start building",
      onClick: () => {}, // Will be set by parent component
    },
  },
];
