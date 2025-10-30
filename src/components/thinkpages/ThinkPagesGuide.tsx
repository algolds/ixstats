"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Users,
  MessageCircle,
  Zap,
  Globe,
  Crown,
  Newspaper,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Heart,
  Shield,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export function ThinkPagesGuide() {
  const [activeSection, setActiveSection] = useState<"about" | "features" | "tips" | null>("about");

  const sections = [
    {
      id: "about",
      icon: BookOpen,
      title: "About ThinkPages",
      color: "text-blue-500 dark:text-blue-400",
      content: (
        <div className="space-y-3 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Thinkpages empowers billions to connect, collaborate, and create through the open
            exchange of thought. We believe every mind has value, and our platform turns individual
            ideas into collective progress.
          </p>
          <div className="bg-muted/50 border-border rounded-lg border p-3">
            <p className="mb-1 text-xs font-medium text-yellow-600 dark:text-amber-300">
              🌟 Stats for Nerds
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">
                Active Networks: <span className="text-foreground">2.47M</span>
              </span>
              <span className="text-muted-foreground">
                Daily Thoughts: <span className="text-foreground">2.1B</span>
              </span>
              <span className="text-muted-foreground">
                ThinkTanks: <span className="text-foreground">185.7K</span>
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "features",
      icon: Sparkles,
      title: "Key Features",
      color: "text-purple-500 dark:text-purple-400",
      content: (
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-500 dark:text-orange-400" />
            <div>
              <p className="text-foreground font-medium">ThinkTanks</p>
              <p className="text-muted-foreground">
                Join discussion groups and collaboration spaces
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500 dark:text-green-400" />
            <div>
              <p className="text-foreground font-medium">ThinkShare</p>
              <p className="text-muted-foreground">
                Private messaging with rich text and real-time features
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-500 dark:text-yellow-400" />
            <div>
              <p className="text-foreground font-medium">Live Intelligence</p>
              <p className="text-muted-foreground">Real-time economic data integration in posts</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tips",
      icon: Lightbulb,
      title: "Pro Tips",
      color: "text-yellow-500 dark:text-yellow-400",
      content: (
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Crown className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500 dark:text-amber-400" />
            <p className="text-muted-foreground">
              Government accounts are auto-verified and carry diplomatic weight
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Newspaper className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-500 dark:text-blue-400" />
            <p className="text-muted-foreground">
              Media accounts can break news and influence public opinion
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Heart className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500 dark:text-red-400" />
            <p className="text-muted-foreground">
              Use reactions and hashtags to amplify your message's reach
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500 dark:text-green-400" />
            <p className="text-muted-foreground">
              Private ThinkTanks require approval; public ones are open to all
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Card className="glass-hierarchy-child overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg dark:bg-[#0050a1]"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-sm font-bold text-white">T</span>
          </motion.div>
          <div>
            <CardTitle className="text-sm font-bold text-blue-600 dark:text-[#0050a1]">
              ThinkPages Guide
            </CardTitle>
            <p className="text-muted-foreground text-xs">Master the art of digital discourse</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-4 pt-0">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <motion.div
              key={section.id}
              layout
              className="border-border overflow-hidden rounded-lg border"
            >
              <motion.button
                onClick={() =>
                  setActiveSection(isActive ? null : (section.id as "about" | "tips" | "features"))
                }
                className="hover:bg-muted/50 flex w-full items-center justify-between p-3 transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${section.color}`} />
                  <span className="text-foreground text-sm font-medium">{section.title}</span>
                </div>
                <motion.div animate={{ rotate: isActive ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="text-muted-foreground h-3 w-3" />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-border border-t"
                  >
                    <div className="bg-muted/30 p-3">{section.content}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
