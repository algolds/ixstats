"use client";

/**
 * BuilderWelcomeModal — First-visit welcome screen for the MyCountry Nation Builder.
 * A Facet Dialog with Tabs; shown once per builder version (localStorage).
 */

import { useState, useEffect, useCallback } from "react";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import {
  Globe,
  Fingerprint,
  Shield,
  Coins,
  ChatBubbleQuestion,
  InfoCircle as Info,
  OpenBook as BookOpen,
  FloppyDisk as Save,
  Emoji as Smile,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { BUILDER_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "mycountry-builder-welcome-seen";

const MAIN_STEPS = [
  {
    icon: Globe,
    bg: "bg-yellow/10",
    title: "1. Foundation",
    description:
      "Choose a real-world template as a baseline, start with a blank slate, or import an IIWiki country page.",
  },
  {
    icon: Fingerprint,
    bg: "bg-teal/10",
    title: "2. Identity",
    description:
      "Choose your nation's name, visual flag, national motto, state model, and write your historic description.",
  },
  {
    icon: Shield,
    bg: "bg-teal/10",
    title: "3. Government",
    description:
      "Select and stack up to 15 active component blocks representing ministries, legislatures, and courts. Discover powerful gameplay combos and synergies.",
  },
  {
    icon: Coins,
    bg: "bg-green/10",
    title: "4. Economics",
    description:
      "Tune fiscal parameters, set sector priorities (services/industry/tech), select tax rates, and allocate budget.",
  },
];

const FAQS = [
  {
    q: "How do baseline templates affect gameplay?",
    a: "Selecting a real-world country template seeds your starting population size and GDP. If you prefer a completely blank slate, starting from scratch grants you a default population of 100,000 and $1 Billion GDP.",
  },
  {
    q: "Can I exit and resume building later?",
    a: "Yes, progress is continuously saved to your browser drafts. A green save indicator at the top right tracks status, letting you safely exit the builder and return to your nation-in-progress at any time.",
  },
  {
    q: "Can I remodel my government after launch?",
    a: "Absolutely. MyCountry has zero lock-in. Once active, you can return to the builder interface at any point to swap state organs, edit symbols, or adjust tax rates as your nation develops.",
  },
];

const ADVANCED_TIPS = [
  {
    icon: Save,
    title: "Continuous Autosave",
    description:
      "Your progress is automatically saved to your account and local session as you work. The studio header displays real-time sync status.",
  },
  {
    icon: ChatBubbleQuestion,
    title: "Halo & Dynamic Guidance",
    description:
      "The floating Halo and Studio Header provide context-aware guidance and validation feedback for every step of statecraft.",
  },
  {
    icon: Info,
    title: "Real-Time Synthesis",
    description:
      "Every slider, institution, and budget change recalculates your projected GDP, tax revenue, stability, and demographic breakdown in real time.",
  },
  {
    icon: Smile,
    title: "Experiment & Have Fun",
    description:
      "Feel free to explore bold ideas! You can always fine-tune your institutions, ministries, and economic parameters in the editor later.",
  },
];

export function BuilderWelcomeModal({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open !== undefined) {
      setShow(open);
      if (open) {
        setActiveTab(0);
      }
    }
  }, [open]);

  useEffect(() => {
    if (open === undefined) {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen || seen !== BUILDER_VERSION) {
          const timer = setTimeout(() => setShow(true), 800);
          return () => clearTimeout(timer);
        }
      } catch {
        // localStorage unavailable
      }
    }
    return;
  }, [open]);

  const handleClose = useCallback(() => {
    setShow(false);
    onOpenChange?.(false);
    try {
      localStorage.setItem(STORAGE_KEY, BUILDER_VERSION);
    } catch {
      // storage unavailable (private mode) — preference is not persisted
    }
  }, [onOpenChange]);

  const TABS = ["Getting Started", "Build Process", "Tips", "FAQ Guide"];

  if (!mounted || !show) return null;

  return (
    <Dialog
      open={show}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <MyCountryLogo size="md" variant="icon-only" animated={false} />
              <div>
                <DialogTitle className="text-title-3">MyCountry Builder Guide</DialogTitle>
                <DialogDescription className="text-footnote">
                  Create your custom nation exactly as you want it.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="tabular-nums">
              v{BUILDER_VERSION}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={String(activeTab)} onValueChange={(value) => setActiveTab(Number(value))}>
          {/* Tab Selector */}
          <TabsList
            role="tablist"
            aria-label="Builder guide"
            className="border-separator gap-1 overflow-x-auto border-b px-6 pb-2"
          >
            {TABS.map((tab, i) => (
              <TabsTrigger key={tab} role="tab" value={String(i)}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content pages */}
          <div className="flex max-h-96 min-h-72 flex-col overflow-y-auto px-6 py-4">
            <TabsContent value="0" role="tabpanel" className="space-y-4 text-left">
              <div className="space-y-2">
                <h3 className="text-label text-headline">Welcome to the MyCountry Builder!</h3>
                <p className="text-footnote text-label-secondary">
                  Here, you will construct a sovereign state from the ground up by choosing its
                  unique identity and policies. You can customize your country by selecting its
                  government, economy, industries, culture, and more.
                </p>
                <p className="text-footnote text-label-secondary">
                  Once finalized, your country joins the World with other players. You will be able
                  to draft laws, enage in diplomacy, trade or form treaties, and more. Your actions
                  will affect your country's development and its relations with other countries.
                </p>
              </div>

              <div className="bg-surface-secondary rounded-row p-3">
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen aria-hidden="true" className="text-tint h-4 w-4" />
                  <h4 className="text-headline text-label">How It Works</h4>
                </div>
                <p className="text-footnote text-label-secondary">
                  Every decision applies real-time modifiers to your GDP growth, stability index,
                  and currency value. All components and sliders can be customized and re-allocated
                  at any time without penalty once your nation is active.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="1" role="tabpanel" className="grid grid-cols-2 gap-2 text-left">
              {MAIN_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="bg-surface-secondary rounded-row p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                      <h4 className="text-headline text-label">{step.title}</h4>
                    </div>
                    <p className="text-footnote text-label-secondary">{step.description}</p>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="2" role="tabpanel" className="space-y-2 text-left">
              {ADVANCED_TIPS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="bg-surface-secondary rounded-row flex items-start gap-3 p-3"
                  >
                    <Icon
                      aria-hidden="true"
                      className="text-label-secondary mt-0.5 h-3.5 w-3.5 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <h4 className="text-headline text-label">{item.title}</h4>
                      <p className="text-footnote text-label-secondary">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="3" role="tabpanel" className="space-y-4 text-left">
              <Eyebrow className="block">Common Questions</Eyebrow>
              <dl className="space-y-3">
                {FAQS.map((faq) => (
                  <div key={faq.q} className="space-y-1">
                    <dt className="text-headline text-label">{faq.q}</dt>
                    <dd className="text-footnote text-label-secondary">{faq.a}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="border-separator border-t px-6 py-4">
          <Button type="button" size="sm" onClick={handleClose}>
            Start Building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
