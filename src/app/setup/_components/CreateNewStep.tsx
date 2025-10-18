"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Plus, Building2, Crown, TrendingUp, Users, Star } from "lucide-react";
import { Button } from "~/components/ui/button";

interface CreateNewStepProps {
  onBack: () => void;
  onCreate: () => void;
  isCreating: boolean;
}

const features = [
  {
    icon: Building2,
    title: "National Identity",
    description: "Define your country's name and flag, and assign your country a currency, language, and other essential symbols.",
    color: "text-blue-600 dark:text-blue-400"
  },
  {
    icon: Crown,
    title: "MyGovernment",
    description: "Customize everything from your political system to your departments and budgets to policies and more.",
    color: "text-purple-600 dark:text-purple-400"
  },
  {
    icon: TrendingUp,
    title: "MyEconomy",
    description: "Configure your industry sectors, labor markets, income distribution, and trade policies to your liking.",
    color: "text-emerald-600 dark:text-emerald-400"
  },
  {
    icon: Users,
    title: "Tax Builder",
    description: "Our integrated tax builder allows you to design a comprehensive tax system with brackets, exemptions, and deductions that is connected to your economy.",
    color: "text-orange-600 dark:text-orange-400"
  }
];

const benefits = [
  "MyCountry: Manage your country in real-time from your Executive Command Center with briefings and policies, monitor your economy and engage in diplomacy with other nations, and more.",
  "MyCountry Builder: Use our builder to customize your country exactly how you want. Customize everything from your government structure to your economy and demographics to your tax system and more.",
  "MyCountry Defense: Establish up to 8 military branches, organize units and assets, readiness levels, and manage national security.",
  "Diplomacy: Establish embassies, conduct cultural exchanges, negotiate treaties, and build relationships that enhance trade opportunities and intelligence cooperation",
  "Compete Globally: Track your nation's ranking across economic, diplomatic, and cultural metrics—unlock achievements and see how you compare to other nations worldwide",
  "ThinkPages: Use ThinkPages to engage as government officials, citizens, or media on our in-world social platform. Collaborate with other players through ThinkTanks and discuss IC or OOC topics.",
  "Wiki Integration: You can import your country's data/lore from IIWiki or AltHistoryWiki if you want to use it as a base for your country",
  "Image Repository: Use our image repository to natively search for images from Wiki Commons, Unsplash, and IIWiki."
];

export function CreateNewStep({ onBack, onCreate, isCreating }: CreateNewStepProps) {
  return (
    <motion.div
      key="create-new"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-10">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-8 glass-hierarchy-child px-6 py-3 rounded-xl"
        >
          <ArrowLeft className="h-5 w-5 mr-3" />
          Back to options
        </Button>

        <h1 className="text-5xl font-bold text-foreground mb-6">
          Create New Country
        </h1>
      </div>

      <div className="glass-hierarchy-parent rounded-3xl p-8 border border-border">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground flex items-center mb-4">
            <div className="glass-hierarchy-child p-3 rounded-xl mr-4">
              <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            MyCountry Builder
          </h2>
          <p className="text-muted-foreground text-lg">
            Build your country exactly how you want. Our builder allows you to customize everything from your government structure to your economy and demographics to
            your policies and manage diplomatic relations. We use a multi-layered Economic Engine that models real-world economic behavior through advanced
            mathematical models, tier-based growth systems, and time-synchronized calculations to ensure a dynamic and realistic world.
          </p>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * (index + 1) }}
                className="glass-hierarchy-child p-6 rounded-2xl text-center group hover:glass-hierarchy-interactive transition-all duration-500"
              >
                <div className="w-20 h-20 glass-hierarchy-child rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className={`h-10 w-10 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="glass-hierarchy-child p-8 rounded-2xl">
            <div className="flex items-center mb-6">
              <div className="glass-hierarchy-child p-3 rounded-xl mr-4">
                <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                What You'll Get
              </h3>
            </div>
            <ul className="space-y-4 text-muted-foreground">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full mr-4 mt-2 flex-shrink-0"></div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={onCreate}
            disabled={isCreating}
            className="w-full glass-hierarchy-interactive py-6 text-lg font-semibold rounded-2xl"
            size="lg"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current mr-4"></div>
                Starting MyCountry Builder...
              </>
            ) : (
              <>
                <Plus className="h-6 w-6 mr-4" />
                Start MyCountry Builder
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
