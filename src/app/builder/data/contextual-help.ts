import type { BuilderSection } from "~/app/builder/lib/builder-theme";

interface HelpStep {
  title: string;
  description: string;
}

export const contextualHelp: Record<BuilderSection, HelpStep[]> = {
  foundation: [
    {
      title: "Choose a country",
      description:
        "Pick a real country as your baseline. Its population, GDP and basic data become your starting values.",
    },
    {
      title: "Start from scratch",
      description:
        "Start from a blank country with default values: 10 million people and a $250 billion GDP.",
    },
    {
      title: "Import from IIWiki",
      description:
        "Import an existing nation's data and lore from IIWiki. You can edit any value after the import.",
    },
  ],
  identity: [
    {
      title: "Name your nation",
      description:
        "Set the country name. It is used in the government, economy and diplomacy sections and across the platform.",
    },
    {
      title: "National symbols",
      description:
        "Set the flag and coat of arms by uploading images or picking them from the IxWiki repository. They appear on your dashboard and on the map.",
    },
    {
      title: "Government type",
      description:
        "Choose a form of government, such as a republic or a monarchy. It is shown on your country profile.",
    },
    {
      title: "National description",
      description: "Write the history, culture and values of your nation.",
    },
  ],
  government: [
    {
      title: "Pick components",
      description:
        "Your government is built from components grouped by what they do: power distribution, decision process, legitimacy, institutions, control mechanisms, administration and social policy. You can pick up to 15.",
    },
    {
      title: "Start with the basics",
      description:
        "Start with how power is distributed and how decisions are made, then add institutions such as the judiciary and the bureaucracy.",
    },
    {
      title: "Synergies and conflicts",
      description:
        "Some components reinforce each other and some conflict. The compatibility feedback shows the effect of each pick as you make it.",
    },
    {
      title: "Costs",
      description:
        "Each component has a setup cost and yearly upkeep. The metrics bar shows the running totals.",
    },
  ],
  economics: [
    {
      title: "Sector distribution",
      description:
        "Set the share of agriculture, industry, services and technology. Concentrating on one sector leaves the economy exposed to shocks in it.",
    },
    {
      title: "Tax and fiscal policy",
      description:
        "Set tax rates, spending allocations and fiscal priorities. Your government components determine which policy options are available.",
    },
    {
      title: "Labor and demographics",
      description:
        "Set workforce participation, wages, unionization and the age and population profile.",
    },
    {
      title: "Economic health",
      description:
        "Watch the indicators as you edit. Green is healthy, amber needs attention and red is a problem.",
    },
  ],
  preview: [
    {
      title: "Review your nation",
      description:
        "Check the identity, government and economy sections. Go back to any step to change it.",
    },
    {
      title: "Check the numbers",
      description:
        "Check GDP, population, growth, sector shares and tax revenue. Inconsistent values are flagged.",
    },
    {
      title: "Create your nation",
      description: "When you are done, create the nation. It then appears in MyCountry.",
    },
  ],
  import: [
    {
      title: "Choose a wiki",
      description:
        "Pick IxWiki, IIWiki or AltHistory Wiki. Each wiki formats its articles differently, so the data you get varies.",
    },
    {
      title: "Find your nation",
      description:
        "Search by name and filter by category. The filter button in the sidebar expands the category options.",
    },
    {
      title: "Review and import",
      description:
        "Preview the parsed infobox before importing. Population, GDP, government type and other values are extracted, and you can edit any of them afterward.",
    },
  ],
};
