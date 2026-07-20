import { motion } from "motion/react";
import {
  CheckCircle,
  HelpCircle,
  MessageSquare,
  Globe,
  BookOpen,
  Calendar,
  Lock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

interface WaitlistDashboardSectionProps {
  email?: string;
  reservedNationName?: string;
}

export function WaitlistDashboardSection({
  email = "your email",
  reservedNationName,
}: WaitlistDashboardSectionProps) {
  const prepSteps = [
    {
      id: "nation",
      title: "Verify NationStates Claim",
      description: reservedNationName
        ? `Pre-verified for nation: ${reservedNationName}`
        : "Will link to your NationStates account automatically",
      status: reservedNationName ? "completed" : "pending",
      icon: Globe,
    },
    {
      id: "discord",
      title: "Join Concord Community",
      description: "Access general chat, trading corridors, and region updates",
      status: "action",
      icon: MessageSquare,
      link: "https://discord.gg/ixwiki", // Example placeholder or config link
    },
    {
      id: "wikios",
      title: "Explore WikiOS",
      description: "Read regional intelligence and player-created lore",
      status: "info",
      icon: BookOpen,
      link: "https://ixwiki.com",
    },
  ];

  return (
    <div className="relative min-h-[80vh] w-full overflow-hidden p-6 md:p-12">
      <TextureOverlay texture="dots" opacity={0.03} />

      <div className="relative z-10 mx-auto max-w-4xl space-y-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 text-center"
        >
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-widest text-amber-400 uppercase backdrop-blur-md"
            >
              Waitlist Active
            </Badge>
          </div>
          <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-6xl">
            Onboarding Underway
          </h1>
          <p className="mx-auto max-w-xl text-sm font-medium text-zinc-400/90 md:text-base">
            Welcome to the IxStats gateway. Your slot is currently reserved. Complete the setup
            checklist below to prepare for immediate access.
          </p>
        </motion.div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="md:col-span-2"
          >
            <TextureCard className="h-full border-zinc-800/60 bg-zinc-950/40 backdrop-blur-xl">
              <TextureCardContent className="space-y-6 p-6 md:p-8">
                <div className="flex items-start justify-between border-b border-zinc-800/60 pb-6">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                      Reservation Email
                    </span>
                    <h3 className="text-lg font-bold text-zinc-200 md:text-xl">{email}</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold tracking-wide text-emerald-400 uppercase">
                      Reserved
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 pt-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Calendar className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        Next Batch Release
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-300">
                      Scheduled: Wave 3 (Upcoming)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <TrendingUp className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        Region Queue
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-300">Priority Onboarding Enabled</p>
                  </div>
                </div>
              </TextureCardContent>
            </TextureCard>
          </motion.div>

          {/* Quick Notice Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <CutoutCard className="flex h-full flex-col justify-between border-amber-500/20 bg-amber-950/10 backdrop-blur-xl">
              <CutoutCardContent className="flex h-full flex-col justify-between space-y-4 p-6">
                <div className="space-y-3">
                  <div className="w-fit rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5">
                    <Lock className="h-5 w-5 text-amber-400" />
                  </div>
                  <h4 className="text-base font-bold text-zinc-200">Pre-Verified Nation</h4>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    If you joined via a VIP invitation, your NationStates identity is pre-locked in.
                    Upon final validation, your cards and deck will import instantly.
                  </p>
                </div>

                <div className="border-t border-zinc-800/40 pt-4">
                  <span className="block text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                    Assigned Nation
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    {reservedNationName ? `@${reservedNationName}` : "Unlinked (pending)"}
                  </span>
                </div>
              </CutoutCardContent>
            </CutoutCard>
          </motion.div>
        </div>

        {/* Checklist Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight text-zinc-200">Onboarding Tasks</h3>
            <span className="text-xs font-medium text-zinc-500">Step progress: 1 of 3</span>
          </div>

          <div className="space-y-4">
            {prepSteps.map((step, idx) => {
              const IconComponent = step.icon;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1, duration: 0.4 }}
                  className="group flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4 transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-800/10 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="border-zinc-850/60 rounded-lg border bg-zinc-950 p-2.5 transition-colors group-hover:border-zinc-800">
                      <IconComponent className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-cyan-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-zinc-300">{step.title}</h4>
                      <p className="text-xs text-zinc-500">{step.description}</p>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                    {step.status === "completed" ? (
                      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Ready</span>
                      </div>
                    ) : step.status === "action" ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:border-zinc-700"
                      >
                        <a href={step.link} target="_blank" rel="noopener noreferrer">
                          <span>Join Discord</span>
                          <ChevronRight className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-800/30 px-3 py-1 text-xs font-medium text-zinc-400">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Optional</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
