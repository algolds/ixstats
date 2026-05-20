import type { BuilderSection } from "~/app/builder/lib/builder-theme";

interface HelpStep {
  title: string;
  description: string;
}

export const contextualHelp: Record<BuilderSection, HelpStep[]> = {
  foundation: [
    {
      title: "Choose Your Foundation",
      description:
        "Select from 180+ real countries as your starting point. Each provides authentic economic data — GDP, population, growth rates — that becomes the baseline for your nation.",
    },
    {
      title: "Filter & Search",
      description:
        "Use archetypes (Developed, Emerging, Resource-Rich, etc.) and the search bar to narrow options. Filters work together — combine them for precise results.",
    },
    {
      title: "Live Preview",
      description:
        "Hover over any country card to see a live preview with economic indicators. Click to soft-select and review full details in the side panel before committing.",
    },
    {
      title: "Import from Wiki",
      description:
        "Already have a nation on IxWiki or IIWiki? Switch to the Import section to pull your existing data directly into the builder.",
    },
  ],
  identity: [
    {
      title: "Name Your Nation",
      description:
        "Building on your foundation country, give your nation a unique name. This identity carries through every section — government, economy, diplomacy — and appears across the platform.",
    },
    {
      title: "National Symbols",
      description:
        "Configure your flag, coat of arms, and visual identity. Upload images or describe them. These symbols represent your nation in the MyCountry dashboard, maps, and diplomatic interfaces.",
    },
    {
      title: "Government Type",
      description:
        "Choose your form of government — democracy, monarchy, republic, etc. This choice directly determines which atomic components are available in the Government section.",
    },
    {
      title: "National Description",
      description:
        "Write your nation's story: history, culture, values, and aspirations. This narrative informs your nation's diplomatic positioning and how other players perceive your country.",
    },
  ],
  government: [
    {
      title: "Atomic Components System",
      description:
        "Your government is built from 24 modular atomic components across 5 categories: Executive, Legislative, Judicial, Administrative, and Specialized. Each component is a self-contained unit with unique effects, costs, and synergies.",
    },
    {
      title: "Core Branches First",
      description:
        "Start with the three essential branches: Executive (President/Prime Minister/Council), Legislature (Parliament/Congress/Assembly), and Judiciary (Supreme Court/Constitutional Court). These form the backbone that all other components connect to.",
    },
    {
      title: "Component Synergies",
      description:
        "Components interact dynamically. Some combinations create powerful synergies (e.g., Parliamentary Executive + Bicameral Legislature), while others may conflict. The system shows real-time compatibility feedback and effect previews.",
    },
    {
      title: "Specialized Components",
      description:
        "Once your core branches are set, add specialized agencies: Intelligence Services, Central Banks, Electoral Commissions, Regulatory Bodies, and more. Each adds capabilities and affects your economic calculations.",
    },
  ],
  economics: [
    {
      title: "Sector Distribution",
      description:
        "Configure your economy's sector breakdown: Agriculture, Industry, Services, and Technology. Your government components influence which sectors are most efficient. Balance is key — over-concentration creates vulnerabilities.",
    },
    {
      title: "Tax & Fiscal Policy",
      description:
        "Set tax rates (income, corporate, consumption), government spending allocations, and fiscal priorities. Your government structure determines available policy options — a welfare state component unlocks social spending sliders, for example.",
    },
    {
      title: "Trade & Currency",
      description:
        "Establish your currency, trade relationships, and economic partnerships. Configure import/export ratios, trade agreements, and monetary policy. Real-time calculations show projected impact on GDP and growth rates.",
    },
    {
      title: "Economic Health Monitoring",
      description:
        "Watch the vitality rings and economic indicators throughout. Green rings indicate healthy metrics, amber signals caution, and red requires attention. The system provides suggestions based on your government and sector configuration.",
    },
  ],
  preview: [
    {
      title: "Review Your Nation",
      description:
        "A comprehensive synthesis of everything you've built: Identity, Government structure, and Economic systems. Review each section's choices and make final adjustments before launch.",
    },
    {
      title: "Verify Economic Indicators",
      description:
        "Check GDP, population, growth rates, sector distributions, and tax revenue projections. Ensure all metrics are within realistic ranges. The system flags any inconsistencies from your configuration.",
    },
    {
      title: "Launch Your Nation",
      description:
        "Once satisfied, create your nation. You'll gain access to the MyCountry Executive Dashboard with diplomatic systems, intelligence operations, and the full simulation experience.",
    },
  ],
  import: [
    {
      title: "Choose Wiki Source",
      description:
        "Select from IxWiki, IIWiki, or AltHistory Wiki as your data source. Each wiki has different article formats and data availability.",
    },
    {
      title: "Search for Your Nation",
      description:
        "Use the search bar and category filters to find your existing nation page. Click the filter icon in the sidebar to expand category filtering options.",
    },
    {
      title: "Review & Import Data",
      description:
        "Preview the parsed infobox data before importing. The system extracts population, GDP, government type, and other metrics. You can edit any field after import in the builder.",
    },
  ],
};
