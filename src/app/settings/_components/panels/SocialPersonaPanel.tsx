"use client";

import { Button } from "~/components/ui/button";
import { useState, useEffect } from "react";
import { User, FloppyDisk as Save, Xmark as X, Clock, Globe, Compass } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow, SettingsSelectRow } from "../primitives";

interface SocialPersonaPanelProps {
  userId: string;
}

type PostingFrequency = "active" | "moderate" | "low";
type PoliticalLean = "left" | "center" | "right";
type Personality = "serious" | "casual" | "satirical";

export function SocialPersonaPanel({ userId: _userId }: SocialPersonaPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  // oxlint-disable-next-line eslint/no-unused-vars
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
        title="Social & ThinkPages"
        category="Platform & preferences"
        description="Rules for automatic posts: how often, in what tone and from what political lean."
        actions={
          primaryAccount && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={updateAccountMutation.isPending}
                    data-cuelume-press="soft"
                    variant="default"
                    size="sm"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{updateAccountMutation.isPending ? "Saving..." : "Save changes"}</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCancel}
                    data-cuelume-press="soft"
                    variant="secondary"
                    size="sm"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  data-cuelume-press="soft"
                  variant="secondary"
                  size="sm"
                >
                  Configure
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Account overview */}
      <SettingsGroup
        title="Persona status"
        description="The ThinkPages account that posts for you."
      >
        <SettingsRow
          label="Handle"
          description={
            primaryAccount
              ? `Posting autonomously as @${primaryAccount.username}`
              : "No ThinkPages persona yet"
          }
          icon={User}
          glyphClass="bg-purple-500/15 text-purple-500"
        >
          {primaryAccount ? (
            <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
              @{primaryAccount.username}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs font-medium">
              Create one in ThinkPages
            </span>
          )}
        </SettingsRow>
      </SettingsGroup>

      {/* Rules */}
      {primaryAccount && (
        <SettingsGroup title="Posting rules" description="How posts are generated on your behalf.">
          <SettingsSelectRow
            id="post-frequency"
            label="Post frequency"
            description="How often your persona posts"
            icon={Clock}
            glyphClass="bg-blue-500/15 text-blue-500"
            value={postingFrequency}
            onValueChange={(val) => {
              setPostingFrequency(val as PostingFrequency);
              setIsEditing(true);
            }}
            options={[
              {
                value: "active",
                label: "High",
                description: "Frequent updates through the day",
              },
              { value: "moderate", label: "Balanced", description: "Standard periodic commentary" },
              {
                value: "low",
                label: "Low",
                description: "Milestone announcements only",
              },
            ]}
          />

          <SettingsSelectRow
            id="political-lean"
            label="Political lean"
            description="Leaning applied when commenting on world affairs"
            icon={Globe}
            glyphClass="bg-indigo-500/15 text-indigo-500"
            value={politicalLean}
            onValueChange={(val) => {
              setPoliticalLean(val as PoliticalLean);
              setIsEditing(true);
            }}
            options={[
              {
                value: "left",
                label: "Progressive",
                description: "Social equity and public investment",
              },
              { value: "center", label: "Neutral", description: "Balanced, pragmatic" },
              {
                value: "right",
                label: "Traditional",
                description: "Sovereignty and traditional values",
              },
            ]}
          />

          <SettingsSelectRow
            id="writing-tone"
            label="Writing tone"
            description="Voice used in generated posts"
            icon={Compass}
            glyphClass="bg-cyan-500/15 text-cyan-500"
            value={personality}
            onValueChange={(val) => {
              setPersonality(val as Personality);
              setIsEditing(true);
            }}
            options={[
              { value: "serious", label: "Analytic", description: "Formal statements" },
              {
                value: "casual",
                label: "Conversational",
                description: "Approachable, everyday tone",
              },
              {
                value: "satirical",
                label: "Provocative",
                description: "Witty and opinionated",
              },
            ]}
          />
        </SettingsGroup>
      )}
    </div>
  );
}
