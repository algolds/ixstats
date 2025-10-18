// Government Step - Atomic components and structure for Atomic Builder
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity (contains government tabs and dialogs)

"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Shield, Info, HelpCircle, Settings, Crown, Coins, Eye,
  Atom, Blocks, Zap, CheckCircle, AlertTriangle, BookOpen, Users,
  Scale, Heart, Globe, TrendingUp, GraduationCap, Sparkles, Trees, Target
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import { stepConfig } from '../builderConfig';
import { AtomicComponentSelector, type ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { GovernmentBuilder } from '~/components/government/GovernmentBuilder';
import { GovernmentSpendingSectionEnhanced } from '~/app/builder/sections/GovernmentSpendingSectionEnhanced';
import { GovernmentStructurePreview } from '../GovernmentStructurePreview';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';

interface GovernmentStepProps {
  economicInputs: EconomicInputs;
  selectedCountry: RealCountryData | null;
  governmentComponents: ComponentType[];
  governmentStructure: any;
  activeGovernmentTab: string;
  onGovernmentComponentsChange: (components: ComponentType[]) => void;
  onGovernmentStructureChange: (structure: any) => void;
  onGovernmentStructureSave: (structure: any) => Promise<void>;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  onTabChange: (tab: string) => void;
}

// Enhanced tab components
function EnhancedTabsList({ children, className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "grid w-full bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </TabsList>
  );
}

function EnhancedTabsTrigger({
  children,
  icon: Icon,
  badge,
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & {
  icon?: React.ElementType;
  badge?: string | number;
}) {
  return (
    <TabsTrigger
      className={cn(
        "relative flex flex-col gap-1.5 p-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200",
        "hover:bg-background/50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        {Icon && React.createElement(Icon, { className: "h-4 w-4" })}
      </div>
      <span className="text-xs font-medium">{children}</span>
      {badge !== undefined && (
        <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]">
          {badge}
        </Badge>
      )}
    </TabsTrigger>
  );
}

// Help tooltip component
function HelpTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function GovernmentStep({
  economicInputs,
  selectedCountry,
  governmentComponents,
  governmentStructure,
  activeGovernmentTab,
  onGovernmentComponentsChange,
  onGovernmentStructureChange,
  onGovernmentStructureSave,
  onEconomicInputsChange,
  onTabChange
}: GovernmentStepProps) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg mb-4">
          <Building2 className="h-8 w-8 text-white" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-3xl font-bold">Design Government Structure</h2>
          <HelpTooltip text={stepConfig.government.help} />
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Build your government using atomic components and configure spending priorities
        </p>
      </motion.div>

      <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Government Configuration:</strong> Select atomic components that will influence your nation's behavior.
          Each component affects economic parameters and creates unique emergent properties.
        </AlertDescription>
      </Alert>

      <Tabs value={activeGovernmentTab} onValueChange={onTabChange} className="space-y-6">
        <EnhancedTabsList className="grid-cols-4">
          <EnhancedTabsTrigger
            value="components"
            icon={Settings}
            badge={governmentComponents.length}
          >
            Atomic Components
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger
            value="structure"
            icon={Crown}
          >
            MyGovernment Builder
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger
            value="spending"
            icon={Coins}
          >
            Policies
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger
            value="preview"
            icon={Eye}
          >
            Preview
          </EnhancedTabsTrigger>
        </EnhancedTabsList>

        {/* COMPONENTS TAB */}
        <TabsContent value="components" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Each component adds unique characteristics to your country and influences some of the calculations</span>
                </div>
                {/* Atomic Components Info Dialog - continues below for space */}
                <AtomicComponentsHelpDialog />
              </div>
              <AtomicComponentSelector
                selectedComponents={governmentComponents}
                onComponentChange={onGovernmentComponentsChange}
                maxComponents={15}
                isReadOnly={false}
              />
            </div>
          </motion.div>
        </TabsContent>

        {/* STRUCTURE TAB */}
        <TabsContent value="structure" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Configure your government structure, departments, budget, and revenue sources</span>
                </div>
                <GovernmentBuilderHelpDialog />
              </div>
            </div>
            <GovernmentBuilder
              initialData={governmentStructure}
              onChange={onGovernmentStructureChange}
              onSave={onGovernmentStructureSave}
              gdpData={{
                nominalGDP: economicInputs?.coreIndicators?.nominalGDP || 0,
                countryName: selectedCountry?.name
              }}
            />
          </motion.div>
        </TabsContent>

        {/* SPENDING/POLICIES TAB */}
        <TabsContent value="spending" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Select policies that align with your atomic components and government structure</span>
                </div>
                <PoliciesHelpDialog />
              </div>
            </div>
            <GovernmentSpendingSectionEnhanced
              inputs={economicInputs}
              onInputsChange={onEconomicInputsChange}
              selectedAtomicComponents={governmentComponents}
              governmentBuilderData={governmentStructure}
              countryId={selectedCountry?.countryCode || undefined}
            />
          </motion.div>
        </TabsContent>

        {/* PREVIEW TAB */}
        <TabsContent value="preview" className="mt-6">
          <GovernmentPreviewTab
            governmentStructure={governmentStructure}
            governmentComponents={governmentComponents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Separate help dialog components to keep the main component clean

function AtomicComponentsHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          What are Atomic Components?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Atom className="h-6 w-6 text-purple-600" />
            Atomic Components
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Dialog content continues - implementing the full help content */}
          <div>
            <p className="text-muted-foreground leading-relaxed">
              Atomic Components are the building blocks of your government.
              Instead of choosing a pre-defined government type, you assemble a custom structure from fundamental
              building blocks that interact with each other to create emergent behaviors and effectiveness levels.
            </p>
          </div>

          {/* Core Principles */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Core Principles</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg h-fit">
                  <Blocks className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">Modularity</h4>
                  <p className="text-sm text-muted-foreground">
                    Each component is independent. Mix and match Power Distribution, Decision Processes,
                    Legitimacy Sources, Institutions, and more freely.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                  <Zap className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Synergy Effects</h4>
                  <p className="text-sm text-muted-foreground">
                    Components interact dynamically. Certain combinations unlock bonuses while others
                    create tensions requiring management.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Component Categories */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Component Categories (72 Total)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Crown, name: "Power Distribution (4)", color: "purple", desc: "Centralized, Federal, Confederate, Unitary systems" },
                { icon: Settings, name: "Decision Processes (4)", color: "blue", desc: "Democratic, Autocratic, Consensus, Technocratic" },
                { icon: Shield, name: "Legitimacy Sources (4)", color: "green", desc: "Electoral, Traditional, Performance, Charismatic" },
                { icon: Building2, name: "Institutions (8)", color: "orange", desc: "Judiciary, Bureaucracy, Military, Security, etc." },
                { icon: Scale, name: "Control Mechanisms (8)", color: "red", desc: "Checks and balances, oversight systems" },
                { icon: Coins, name: "Economic Governance (8)", color: "yellow", desc: "Market, Command, Mixed economy systems" },
                { icon: Users, name: "Administrative (8)", color: "indigo", desc: "Efficiency, decentralization, management" },
                { icon: Heart, name: "Social Policy (8)", color: "pink", desc: "Welfare, education, healthcare systems" },
                { icon: Globe, name: "International Relations (8)", color: "cyan", desc: "Diplomacy, alliances, trade policies" },
                { icon: TrendingUp, name: "Innovation & Development (8)", color: "emerald", desc: "R&D, technology, entrepreneurship" },
                { icon: AlertTriangle, name: "Crisis Management (4)", color: "amber", desc: "Emergency response, risk management" }
              ].map((category, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <category.icon className={`w-4 h-4 text-${category.color}-600`} />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">{category.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GovernmentBuilderHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Government Builder Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-blue-600" />
            Government Builder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground leading-relaxed">
              The Government Builder transforms your selected atomic components into a complete government structure.
              It automatically generates departments, budget allocations, and revenue sources based on your choices,
              while allowing you to customize and fine-tune the details.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PoliciesHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Policies Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-green-600" />
            Government Policies
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground leading-relaxed">
              Government policies are specific spending priorities and programs that complement your atomic components.
              They are dynamically filtered based on your selected components, ensuring that only relevant and
              compatible policies are available for selection.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GovernmentPreviewTab({
  governmentStructure,
  governmentComponents
}: {
  governmentStructure: any;
  governmentComponents: ComponentType[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-foreground">
            Government Structure Preview
          </h3>
          <p className="text-muted-foreground mt-1">
            Review your government configuration before saving
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          <Eye className="h-3 w-3 mr-1" />
          Preview Mode
        </Badge>
      </div>

      <GovernmentStructurePreview
        governmentStructure={governmentStructure}
        governmentComponents={governmentComponents}
      />
    </motion.div>
  );
}
