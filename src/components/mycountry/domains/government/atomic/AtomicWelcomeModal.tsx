"use client";

/**
 * AtomicWelcomeModal — First-visit welcome screen for Atomic Government Builder.
 * Backed by shared DomainWelcomeModal primitive.
 */

import React from "react";
import {
  Component as Blocks,
  Crown,
  Flash as Zap,
  Shield,
  StatUp as TrendingUp,
} from "iconoir-react";
import { DomainWelcomeModal, type DomainTip } from "~/components/shared/atomic-picker";
import { ATOMIC_WELCOME_VERSION } from "~/lib/buildVersion";

const GOVERNMENT_TIPS: DomainTip[] = [
  {
    icon: Blocks,
    title: "Select up to 15 components",
    description:
      "Choose building blocks that define your state, from supreme authority and court systems to public services. There are no mandatory picks. Build the exact system of government you envision.",
  },
  {
    icon: Crown,
    title: "Shape your priorities",
    description:
      "Components span power structures, legitimacy, legal systems, security, and administration. Distribute authority broadly or concentrate heavily in a few areas to match your nation's identity.",
  },
  {
    icon: Zap,
    title: "Combine components",
    description:
      "Components that reinforce each other unlock synergy bonuses to your total effectiveness score. For example, pairing Rule of Law with an Independent Judiciary creates mutual stability.",
    badge: "Synergies",
  },
  {
    icon: Shield,
    title: "Navigate conflicts",
    description:
      "Opposing choices introduce political friction and lower net effectiveness, but you are free to keep them. Whether you want a harmonious consensus or an unstable, contradictory regime is entirely up to you.",
    badge: "Conflicts",
  },
  {
    icon: TrendingUp,
    title: "Track costs and upkeep",
    description:
      "The top metrics bar recalculates live as you pick components. It tracks your net effectiveness, upfront setup spend, and ongoing annual upkeep in real time so you can manage institutional power on your own terms.",
    badge: "Metrics",
  },
];

export interface AtomicWelcomeModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AtomicWelcomeModal({ open, onOpenChange }: AtomicWelcomeModalProps) {
  return (
    <DomainWelcomeModal
      open={open}
      onOpenChange={onOpenChange}
      storageKey="atomic-builder-welcome-seen"
      version={ATOMIC_WELCOME_VERSION}
      title="Government builder guide"
      subtitle="How components, synergies, and budget recommendations work"
      tips={GOVERNMENT_TIPS}
      theme="amber"
    />
  );
}
