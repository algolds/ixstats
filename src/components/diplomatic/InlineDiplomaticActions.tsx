"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import {
  FileText,
  Gift,
  Plane,
  Handshake,
  Send,
  Loader2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface InlineDiplomaticActionsProps {
  viewerCountryId?: string;
  viewerCountryName?: string;
  targetCountryId: string;
  targetCountryName: string;
  isOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function InlineDiplomaticActions({
  viewerCountryId,
  viewerCountryName,
  targetCountryId,
  targetCountryName,
  isOwner,
  isOpen,
  onClose
}: InlineDiplomaticActionsProps) {
  const [selectedAction, setSelectedAction] = useState<"treaty" | "gift" | "mission" | null>(null);
  const [selectedTreatyType, setSelectedTreatyType] = useState<string>("");
  const [selectedGiftType, setSelectedGiftType] = useState<string>("");
  const [missionDescription, setMissionDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get viewer's user profile to get clerkUserId
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!viewerCountryId
  });

  const viewerUserId = userProfile?.userId;

  // Treaty Types with immersive descriptions
  const treatyTypes = [
    { value: "trade", label: "🤝 Free Trade Agreement", desc: "Reduce trade barriers and increase economic cooperation" },
    { value: "defense", label: "🛡️ Mutual Defense Pact", desc: "Commit to defending each other in times of conflict" },
    { value: "cultural", label: "🎭 Cultural Exchange Treaty", desc: "Promote cultural understanding and exchange programs" },
    { value: "research", label: "🔬 Research Collaboration", desc: "Joint scientific and technological research initiatives" },
    { value: "environment", label: "🌍 Environmental Protection", desc: "Coordinate on climate and environmental policies" },
    { value: "navigation", label: "⚓ Freedom of Navigation", desc: "Guarantee safe passage through territorial waters" },
    { value: "extradition", label: "⚖️ Extradition Treaty", desc: "Cooperate on law enforcement and criminal justice" },
    { value: "investment", label: "💼 Bilateral Investment", desc: "Protect and promote foreign direct investment" }
  ];

  // Diplomatic Gifts with roleplay flavor
  const giftTypes = [
    { value: "art", label: "🎨 National Art Collection", desc: "Priceless works from your nation's finest artists", impact: "+5 Cultural Relations" },
    { value: "technology", label: "💻 Advanced Technology Package", desc: "Cutting-edge tech and industrial secrets", impact: "+8 Economic Relations" },
    { value: "cultural", label: "🏛️ Cultural Heritage Artifacts", desc: "Historic treasures and archaeological finds", impact: "+6 Cultural Relations" },
    { value: "economic", label: "💰 Economic Development Fund", desc: "$50M grant for infrastructure projects", impact: "+10 Economic Relations" },
    { value: "scientific", label: "🔬 Scientific Research Data", desc: "Breakthrough research and experimental data", impact: "+7 Research Relations" },
    { value: "sports", label: "⚽ Sports Equipment & Training", desc: "Olympic-grade equipment and coaching staff", impact: "+4 Cultural Relations" },
    { value: "military", label: "🪖 Military Equipment Aid", desc: "Defense systems and training programs", impact: "+12 Defense Relations" },
    { value: "humanitarian", label: "❤️ Humanitarian Aid Package", desc: "Medical supplies, food, and disaster relief", impact: "+15 Goodwill" }
  ];

  // Create conversation mutation using country IDs
  const createConversationMutation = api.thinkpages.createConversationByCountries.useMutation({
    onSuccess: () => {
      toast.success("Secure diplomatic channel created!");
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to create channel: ${error.message}`);
    }
  });

  // Send initial message mutation
  const sendInitialMessageMutation = api.thinkpages.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Diplomatic action sent via secure channel!");
    }
  });

  // Handle Propose Treaty
  const handleProposeTreaty = async () => {
    if (!viewerCountryId || !viewerUserId) {
      toast.error("Unable to initiate diplomatic channel - please log in");
      return;
    }

    if (!selectedTreatyType) {
      toast.error("Please select a treaty type");
      return;
    }

    const treaty = treatyTypes.find(t => t.value === selectedTreatyType);
    if (!treaty) return;

    setIsSubmitting(true);

    try {
      // Create a new secure conversation using country IDs
      const conversation = await createConversationMutation.mutateAsync({
        fromCountryId: viewerCountryId,
        toCountryId: targetCountryId,
        initialMessage: undefined
      });

      // Send the initial treaty proposal message
      await sendInitialMessageMutation.mutateAsync({
        conversationId: conversation.id,
        userId: viewerUserId,
        content: `🤝 **TREATY PROPOSAL**\n\n${treaty.label}\n\n${treaty.desc}\n\nOur government proposes this formal agreement. Please review and respond with your country's position.`,
        messageType: "text"
      });

      setSelectedAction(null);
      setSelectedTreatyType("");
      onClose();
    } catch (error) {
      console.error('Treaty proposal error:', error);
      // Error already handled by mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Send Gift
  const handleSendGift = async () => {
    if (!viewerCountryId || !viewerUserId) {
      toast.error("Unable to initiate diplomatic channel - please log in");
      return;
    }

    if (!selectedGiftType) {
      toast.error("Please select a gift");
      return;
    }

    const gift = giftTypes.find(g => g.value === selectedGiftType);
    if (!gift) return;

    setIsSubmitting(true);

    try {
      // Create a new secure conversation using country IDs
      const conversation = await createConversationMutation.mutateAsync({
        fromCountryId: viewerCountryId,
        toCountryId: targetCountryId,
        initialMessage: undefined
      });

      // Send the gift notification message
      await sendInitialMessageMutation.mutateAsync({
        conversationId: conversation.id,
        userId: viewerUserId,
        content: `🎁 **DIPLOMATIC GIFT SENT**\n\n${gift.label}\n\n${gift.desc}\n\nExpected Impact: ${gift.impact}\n\nOur government sends this gift as a gesture of goodwill and to strengthen our bilateral relationship.`,
        messageType: "text"
      });

      setSelectedAction(null);
      setSelectedGiftType("");
      onClose();
    } catch (error) {
      console.error('Gift sending error:', error);
      // Error already handled by mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Propose Mission
  const handleProposeMission = async () => {
    if (!viewerCountryId || !viewerUserId) {
      toast.error("Unable to initiate diplomatic channel - please log in");
      return;
    }

    if (!missionDescription.trim()) {
      toast.error("Please describe the mission purpose");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a new secure conversation using country IDs
      const conversation = await createConversationMutation.mutateAsync({
        fromCountryId: viewerCountryId,
        toCountryId: targetCountryId,
        initialMessage: undefined
      });

      // Send the mission proposal message
      await sendInitialMessageMutation.mutateAsync({
        conversationId: conversation.id,
        userId: viewerUserId,
        content: `✈️ **DIPLOMATIC MISSION PROPOSAL**\n\n${missionDescription}\n\nWe await your government's approval and coordination for this official visit.`,
        messageType: "text"
      });

      setSelectedAction(null);
      setMissionDescription("");
      onClose();
    } catch (error) {
      console.error('Mission proposal error:', error);
      // Error already handled by mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4"
          >
            <div className="relative rounded-2xl p-6 shadow-2xl border border-white/20 backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/40 dark:via-black/20 dark:to-transparent">
              {/* Glass reflection effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />

              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Handshake className="h-6 w-6 text-indigo-400" />
                      Diplomatic Actions
                    </h3>
                    <p className="text-sm text-white/60 mt-1">
                      Engage with {targetCountryName}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all duration-200 group"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-white/60 group-hover:text-white transition-colors" />
                  </button>
                </div>

                {isOwner ? (
                  <div className="text-center py-12 text-white/70">
                    <Handshake className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>This is your country. Visit other countries to perform diplomatic actions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Action Selection */}
                    {!selectedAction && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-2 p-4 bg-white/5 hover:bg-purple-500/20 border-white/20 hover:border-purple-500/50 text-white"
                          onClick={() => setSelectedAction("treaty")}
                          disabled={!viewerCountryId || !viewerUserId}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <FileText className="h-5 w-5 text-purple-400" />
                            <span className="font-semibold">Propose Treaty</span>
                          </div>
                          <span className="text-xs text-white/60 text-left">
                            Draft and negotiate formal agreements
                          </span>
                        </Button>

                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-2 p-4 bg-white/5 hover:bg-purple-500/20 border-white/20 hover:border-purple-500/50 text-white"
                          onClick={() => setSelectedAction("gift")}
                          disabled={!viewerCountryId || !viewerUserId}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Gift className="h-5 w-5 text-purple-400" />
                            <span className="font-semibold">Send Diplomatic Gift</span>
                          </div>
                          <span className="text-xs text-white/60 text-left">
                            Strengthen ties with valuable gifts
                          </span>
                        </Button>

                        <Button
                          variant="outline"
                          className="h-auto flex-col items-start gap-2 p-4 bg-white/5 hover:bg-purple-500/20 border-white/20 hover:border-purple-500/50 text-white"
                          onClick={() => setSelectedAction("mission")}
                          disabled={!viewerCountryId || !viewerUserId}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Plane className="h-5 w-5 text-purple-400" />
                            <span className="font-semibold">Diplomatic Mission</span>
                          </div>
                          <span className="text-xs text-white/60 text-left">
                            Send an official delegation visit
                          </span>
                        </Button>
                      </div>
                    )}

                    {(!viewerCountryId || !viewerUserId) && !selectedAction && (
                      <div className="mt-4 text-xs text-center text-amber-300 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        Login required to perform diplomatic actions
                      </div>
                    )}

                    {/* Treaty Proposal Form */}
                    {selectedAction === "treaty" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText className="h-5 w-5 text-purple-400" />
                            Propose Treaty to {targetCountryName}
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAction(null)}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                          >
                            Back
                          </Button>
                        </div>
                        <p className="text-sm text-white/60">
                          Select a treaty type to propose formal negotiations
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {treatyTypes.map((treaty) => (
                            <button
                              key={treaty.value}
                              onClick={() => setSelectedTreatyType(treaty.value)}
                              className={cn(
                                "p-4 rounded-lg border-2 text-left transition-all",
                                selectedTreatyType === treaty.value
                                  ? "border-purple-400 bg-purple-500/20"
                                  : "border-white/20 bg-white/5 hover:bg-white/10"
                              )}
                            >
                              <div className="font-semibold text-sm mb-1 text-white">{treaty.label}</div>
                              <div className="text-xs text-white/60">{treaty.desc}</div>
                            </button>
                          ))}
                        </div>
                        <Button
                          onClick={handleProposeTreaty}
                          disabled={!selectedTreatyType || isSubmitting}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          size="lg"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending Proposal...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Treaty Proposal
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Gift Selection Form */}
                    {selectedAction === "gift" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Gift className="h-5 w-5 text-purple-400" />
                            Send Diplomatic Gift to {targetCountryName}
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAction(null)}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                          >
                            Back
                          </Button>
                        </div>
                        <p className="text-sm text-white/60">
                          Choose a gift to strengthen diplomatic relations
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {giftTypes.map((gift) => (
                            <button
                              key={gift.value}
                              onClick={() => setSelectedGiftType(gift.value)}
                              className={cn(
                                "p-4 rounded-lg border-2 text-left transition-all",
                                selectedGiftType === gift.value
                                  ? "border-purple-400 bg-purple-500/20"
                                  : "border-white/20 bg-white/5 hover:bg-white/10"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-semibold text-sm text-white">{gift.label}</div>
                                <Badge variant="outline" className="text-xs border-white/30 text-white/70">
                                  {gift.impact}
                                </Badge>
                              </div>
                              <div className="text-xs text-white/60">{gift.desc}</div>
                            </button>
                          ))}
                        </div>
                        <Button
                          onClick={handleSendGift}
                          disabled={!selectedGiftType || isSubmitting}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          size="lg"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending Gift...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Gift
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Mission Proposal Form */}
                    {selectedAction === "mission" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Plane className="h-5 w-5 text-purple-400" />
                            Propose Diplomatic Mission to {targetCountryName}
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAction(null)}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                          >
                            Back
                          </Button>
                        </div>
                        <p className="text-sm text-white/60">
                          Describe the purpose and goals of your diplomatic mission
                        </p>
                        <Textarea
                          value={missionDescription}
                          onChange={(e) => setMissionDescription(e.target.value)}
                          placeholder="Example: 'We propose a high-level diplomatic mission to discuss strengthening economic ties, with focus on trade agreements and investment opportunities. Our delegation will include the Minister of Commerce and senior trade officials.'"
                          className="min-h-[120px] bg-white/10 border-white/20 text-white placeholder:text-white/40"
                          maxLength={500}
                        />
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Be specific about mission objectives</span>
                          <span>{missionDescription.length}/500</span>
                        </div>
                        <Button
                          onClick={handleProposeMission}
                          disabled={!missionDescription.trim() || isSubmitting}
                          className="w-full bg-purple-500 hover:bg-purple-600"
                          size="lg"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Proposing Mission...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Propose Mission
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
