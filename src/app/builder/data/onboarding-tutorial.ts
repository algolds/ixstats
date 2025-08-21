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
    title: "Choose Your Foundation",
    short_description: "Select from 180+ real countries as your economic starting point",
    full_description: "Every great nation starts with a foundation. Browse our database of real countries and choose one that matches your vision. Each foundation provides authentic economic data that you can customize.",
    media: {
      type: "image", 
      src: "https://images.unsplash.com/photo-1535483102974-fa1e64d0ca86?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    }
  },
  {
    title: "Design Your Economy",
    short_description: "Customize GDP, population, and core economic indicators",
    full_description: "Shape your nation's economic foundation. Adjust population size, GDP per capita, growth rates, and watch as the system calculates related metrics in real-time.",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Economic charts and analysis"
    }
  },
  {
    title: "Define Your Identity",
    short_description: "Upload symbols and customize your nation's character",
    full_description: "Upload your flag and coat of arms to give your nation visual identity. The system will extract colors to theme your experience, making it uniquely yours.",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1529019828431-c67133e9b99a?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Various national flags"
    }
  },
  {
    title: "Monitor Your Nation",
    short_description: "Track economic health with interactive vitality rings",
    full_description: "See your nation's health at a glance with Apple-inspired vitality rings. Economic, Social, and Government indicators update in real-time as you make changes.",
    action: {
      label: "Start Building Now",
      onClick: () => {} // Will be set by parent component
    },
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1557426272-fc759fdf7a8d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Data visualization dashboard"
    }
  }
];

export const quickStartSteps: Step[] = [
  {
    title: "Quick Start Guide",
    short_description: "Get building in 3 simple steps",
    full_description: "New to nation building? Follow this quick guide to create your first country in minutes.",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Getting started"
    }
  },
  {
    title: "Step 1: Choose Your Foundation",
    short_description: "Pick a country similar to what you want to create",
    full_description: "Browse by economic tier, region, or population size. Popular foundations include Luxembourg (high-tech), Norway (social democracy), and Germany (manufacturing hub).",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1589519160142-77d1a51b1c5e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Country selection"
    }
  },
  {
    title: "Step 2: Customize Key Metrics",
    short_description: "Adjust population, GDP, and basic economic settings",
    full_description: "Start with Core Indicators: set your country name, adjust population and GDP to your desired size, and set growth rates. The system will auto-calculate related metrics.",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Economic metrics dashboard"
    }
  },
  {
    title: "Step 3: Preview & Create",
    short_description: "Review your nation and launch into MyCountry",
    full_description: "Check the vitality rings to ensure your economy is healthy. Review the economic summary, then create your nation to begin the full MyCountry simulation experience.",
    action: {
      label: "Begin Quick Start",
      onClick: () => {} // Will be set by parent component  
    },
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1551836022-8b2858c9c69b?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Final review and creation"
    }
  }
];

export const importGuideSteps: Step[] = [
  {
    title: "Import Your Data",
    short_description: "Already have country data? Import it directly",
    full_description: "If you have existing country data in a spreadsheet or from another source, you can import it directly to get started quickly.",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Data import process"
    }
  },
  {
    title: "Supported Data Formats",
    short_description: "CSV, Excel, or direct copy-paste from your source",
    full_description: "Upload CSV/Excel files with your country data, or copy-paste directly from spreadsheets. The system will intelligently map your data to the appropriate fields.",
    action: {
      label: "Go to Import Page",
      href: "/builder/import"
    },
    media: {
      type: "image", 
      src: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      alt: "Spreadsheet and data files"
    }
  }
];