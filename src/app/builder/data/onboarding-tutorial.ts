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
    title: "Welcome to MyCountry Builder",
    short_description: "The world's most advanced nation creation platform",
    full_description: "Create a fully functional country with atomic government systems, real-time economic calculations, and comprehensive diplomatic frameworks. This tutorial will guide you through the key features."
  },
  {
    title: "Choose Your Foundation",
    short_description: "Select from 180+ real countries as your starting point",
    full_description: "Browse our database of real countries and choose one that matches your vision. Each foundation provides authentic economic data including GDP, population, and growth rates.\n\n**Pro Tip:** Choose countries with similar economic structures to save time in customization."
  },
  {
    title: "Core Identity & Economic Indicators",
    short_description: "Set your nation's identity and fundamental economic metrics",
    full_description: "Configure your country name, national symbols, population, GDP per capita, and growth rates. The system uses a tier-based economic engine that automatically calculates related metrics.\n\n**Key Features:** Real-time calculations and economic projections.\n**Pro Tip:** Start with realistic numbers - the system provides validation ranges."
  },
  {
    title: "Atomic Government System",
    short_description: "Build your government with 24 components",
    full_description: "Choose from 24 government components across 5 categories: Executive, Legislative, Judicial, Administrative, and Specialized. Each component has unique effects and synergies.\n\n**Pro Tip:** Start with core components (Executive, Legislature, Judiciary) then add specialized ones."
  },
  {
    title: "Economic Systems & Policies",
    short_description: "Configure your nation's economic framework",
    full_description: "Set up sector distributions, trade relationships, tax policies, and demographic settings. The system provides real-time feedback on economic health and government spending allocations.\n\n**Pro Tip:** Balance your sectors carefully - too much focus on one sector can create vulnerabilities."
  },
  {
    title: "Preview & Launch Your Nation",
    short_description: "Review your nation and launch into MyCountry",
    full_description: "Review all your choices in the comprehensive preview system. Check economic indicators, government structure, and overall nation health.\n\n**What's Next:** You'll gain access to the MyCountry Executive Dashboard with diplomatic systems and intelligence operations.",
    action: {
      label: "Launch MyCountry",
      onClick: () => {} // Will be set by parent component
    }
  }
];

export const quickStartSteps: Step[] = [
  {
    title: "Quick Start Guide",
    short_description: "Get building in 4 simple steps",
    full_description: "This quick guide will get you up and running in minutes. We'll focus on the essentials: core economic setup and basic government configuration.\n\n**Pro Tip:** You can always explore advanced features later - start simple and build complexity over time."
  },
  {
    title: "Step 1: Core Economic Indicators",
    short_description: "Set your country name and key economic metrics",
    full_description: "Configure your country name and adjust the basics: population size, GDP per capita, and growth rate. The system automatically calculates related metrics.\n\n**Pro Tip:** Start with realistic numbers - the system provides validation ranges."
  },
  {
    title: "Step 2: Basic Government Setup",
    short_description: "Choose essential government components",
    full_description: "Select core government components: Executive (President/Prime Minister), Legislature (Parliament/Congress), and Judiciary (Supreme Court). These provide the foundation for your government.\n\n**Pro Tip:** Start with these three core components - you can add specialized components later."
  },
  {
    title: "Step 3: Preview & Launch",
    short_description: "Review your nation and launch into MyCountry",
    full_description: "Check the vitality rings to ensure your economy is healthy (aim for green rings). Review the economic summary, then create your nation to begin the full MyCountry simulation experience.\n\n**Pro Tip:** You can always return to the builder later to make adjustments - don't worry about perfection on your first try.",
    action: {
      label: "Begin Quick Start",
      onClick: () => {} // Will be set by parent component  
    }
  }
];

export const importGuideSteps: Step[] = [
  {
    title: "Import Your Data",
    short_description: "Already have country data? Import it directly",
    full_description: "If you have existing country data in a spreadsheet or from another source, you can import it directly to get started quickly."
  },
  {
    title: "Supported Data Formats",
    short_description: "CSV, Excel, or direct copy-paste from your source",
    full_description: "Upload CSV/Excel files with your country data, or copy-paste directly from spreadsheets. The system will intelligently map your data to the appropriate fields.",
    action: {
      label: "Go to Import Page",
      href: "/builder/import"
    }
  }
];