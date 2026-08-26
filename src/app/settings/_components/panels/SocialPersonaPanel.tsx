"use client";

import { useState, useEffect } from "react";
import {
  User,
  FloppyDisk as Save,
  Xmark as X,
  Clock,
  Globe,
  Compass,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSelectRow,
} from "../primitives";

interface SocialPersonaPanelProps {
  userId: string;
}

type PostingFrequency = "active" | "moderate" | "low";
type PoliticalLean = "left" | "center" | "right";
type Personality = "serious" | "casual" | "satirical";

export function SocialPersonaPanel({ userId: _userId }: SocialPersonaPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: myAccounts, isLoading } = api.thinkpages.getMyAccounts.useQuery();
  const primaryAccount = myAccounts?.[0];

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation({
    onSuccess: () => {
      notify.success("Social persona settings updated");
      setIsEditing(false);
      void utils.thinkpages.getMyAccounts.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to update persona"),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [postingFrequency, setPostingFrequency] = useState<PostingFrequency>("moderate");
  const [politicalLean, setPoliticalLean] = useState<PoliticalLean>("center");
  const [personality, setPersonality] = useState<Personality>("casual");

  useEffect(() => {
    if (primaryAccount) {
      if (primaryAccount.postingFrequency) {
        setPostingFrequency(primaryAccount.postingFrequency as PostingFrequency);
      }
      if (primaryAccount.politicalLean) {
        setPoliticalLean(primaryAccount.politicalLean as PoliticalLean);
      }
      if (primaryAccount.personality) {
        setPersonality(primaryAccount.personality as Personality);
      }
    }
  }, [primaryAccount]);

  const handleSave = () => {
    if (!primaryAccount?.id) return;
    updateAccountMutation.mutate({
      accountId: primaryAccount.id,
      postingFrequency,
      politicalLean,
      personality,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (primaryAccount) {
      setPostingFrequency((primaryAccount.postingFrequency as PostingFrequency) || "moderate");
      setPoliticalLean((primaryAccount.politicalLean as PoliticalLean) || "center");
      setPersonality((primaryAccount.personality as Personality) || "casual");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Social & Thinkpages"
        category="Platform & Preferences"
        description="Configure autonomous social broadcasting rules, publishing cadence, and editorial style."
        actions={
          primaryAccount && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={updateAccountMutation.isPending}
                    data-cuelume-press="soft"
                    className="facet-interactive flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{updateAccountMutation.isPending ? "Saving..." : "Save Changes"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    data-cuelume-press="soft"
                    className="facet-interactive flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-[0.98]"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  data-cuelume-press="soft"
                  className="facet-interactive rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-[0.98]"
                >
                  Configure
                </button>
              )}
            </div>
          )
        }
      />

      {/* Account Overview */}
      <SettingsGroup
        title="Persona Status"
        description="Active social broadcaster handle registered to your diplomat profile."
      >
        <SettingsRow
          label="Broadcaster Handle"
          description={
            primaryAccount
              ? `Posting autonomously as @${primaryAccount.username}`
              : "No active Thinkpages persona registered yet"
          }
          icon={User}
          glyphClass="bg-purple-500/15 text-purple-500"
        >
          {primaryAccount ? (
            <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
              @{primaryAccount.username}
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              Visit Thinkpages to initialize
            </span>
          )}
        </SettingsRow>
      </SettingsGroup>

      {/* Rules */}
      {primaryAccount && (
        <SettingsGroup
          title="Autonomous Rules"
          description="Dictate how autonomous simulation engines generate content on your behalf."
        >
          <SettingsSelectRow
            id="post-frequency"
            label="Post Frequency"
            description="How often your persona generates autonomous status updates"
            icon={Clock}
            glyphClass="bg-blue-500/15 text-blue-500"
            value={postingFrequency}
            onValueChange={(val) => {
              setPostingFrequency(val as PostingFrequency);
              setIsEditing(true);
            }}
            options={[
              { value: "active", label: "High Output", description: "Frequent updates throughout the simulation day" },
              { value: "moderate", label: "Balanced", description: "Standard periodic commentary" },
              { value: "low", label: "Subtle", description: "Infrequent milestone announcements only" },
            ]}
          />

          <SettingsSelectRow
            id="political-lean"
            label="Political Lean"
            description="Ideological leaning applied when commenting on global affairs"
            icon={Globe}
            glyphClass="bg-indigo-500/15 text-indigo-500"
            value={politicalLean}
            onValueChange={(val) => {
              setPoliticalLean(val as PoliticalLean);
              setIsEditing(true);
            }}
            options={[
              { value: "left", label: "Progressive", description: "Focus on social equity and public investment" },
              { value: "center", label: "Neutral", description: "Balanced pragmatic evaluation" },
              { value: "right", label: "Traditional", description: "Focus on sovereignty and traditional values" },
            ]}
          />

          <SettingsSelectRow
            id="writing-tone"
            label="Writing Tone"
            description="Voice and temperament used in generated broadcasts"
            icon={Compass}
            glyphClass="bg-cyan-500/15 text-cyan-500"
            value={personality}
            onValueChange={(val) => {
              setPersonality(val as Personality);
              setIsEditing(true);
            }}
            options={[
              { value: "serious", label: "Analytic", description: "Formal diplomatic statements" },
              { value: "casual", label: "Conversational", description: "Approachable civilian tone" },
              { value: "satirical", label: "Provocative", description: "Witty and opinionated commentary" },
            ]}
          />
        </SettingsGroup>
      )}
    </div>
  );
}
