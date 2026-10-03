"use client";

/**
 * BuilderWelcomeModal — First-visit welcome screen for the MyCountry Nation Builder.
 * A dialog with tabs; shown once per builder version (localStorage).
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
  FloppyDisk as Save,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { BUILDER_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "mycountry-builder-welcome-seen";

const MAIN_STEPS = [
  {
    icon: Globe,
    title: "1. Foundation",
    description:
      "Start from a real country or archetype, start from scratch, or import an IIWiki country page.",
  },
  {
    icon: Fingerprint,
    title: "2. Identity",
    description: "Set the name, flag, motto, government type and description.",
  },
  {
    icon: Shield,
    title: "3. Government",
    description:
      "Pick up to 15 components for ministries, legislatures and courts. Some combinations add synergies, others conflict.",
  },
  {
    icon: Coins,
    title: "4. Economics",
    description: "Set the sector mix, tax rates, labor, demographics and the budget.",
  },
];

const FAQS = [
  {
    q: "What does a template change?",
    a: "A real country sets your starting population and GDP from that country. Starting from scratch uses the defaults: 10 million people and a $250 billion GDP.",
  },
  {
    q: "Can I leave and come back?",
    a: "Yes. Your draft saves as you work. Return to the builder and choose Resume to pick up where you stopped.",
  },
  {
    q: "Can I change my country after I create it?",
    a: "Yes. You can edit the government, symbols, tax rates and other settings in the country editor at any time.",
  },
];

const ADVANCED_TIPS = [
  {
    icon: Save,
    title: "Autosave",
    description: "Your draft saves automatically while you work.",
  },
  {
    icon: ChatBubbleQuestion,
    title: "Halo and the step guide",
    description: "Halo and the Guide button show alerts and tips for the step you are on.",
  },
  {
    icon: Info,
    title: "Live figures",
    description:
      "Sliders, components and budget changes update the calculated figures as you edit.",
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

  const TABS = ["Overview", "Steps", "Tips", "FAQ"];

  if (!mounted || !show) return null;

  return (
    <Dialog
      open={show}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <MyCountryLogo size="md" variant="icon-only" animated={false} />
              <div>
                <DialogTitle className="text-title-3">MyCountry builder</DialogTitle>
                <DialogDescription className="text-footnote">
                  Build your own nation.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="tabular-nums">
              v{BUILDER_VERSION}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={String(activeTab)} onValueChange={(value) => setActiveTab(Number(value))}>
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

          <div className="flex max-h-96 min-h-72 flex-col overflow-y-auto px-6 py-4">
            <TabsContent value="0" role="tabpanel" className="space-y-4 text-left">
              <div className="space-y-2">
                <h3 className="text-label text-headline">What you will build</h3>
                <p className="text-footnote text-label-secondary">
                  You choose a government, economy, culture and symbols for a new country. When you
                  create it, it joins the world alongside other players' countries.
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

        <DialogFooter className="border-separator border-t px-6 py-4">
          <Button type="button" size="sm" onClick={handleClose}>
            Start building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
