import { useState } from "react";
import { Save, X } from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { TextureOverlay } from "~/components/ui/texture-overlay";

interface ThinkPagesSettingsCardProps {
  thinkpagesAccount: any;
  updateThinkpagesAccountMutation: any;
  onRefetch: () => void;
}

export function ThinkPagesSettingsCard({
  thinkpagesAccount,
  updateThinkpagesAccountMutation,
  onRefetch,
}: ThinkPagesSettingsCardProps) {
  const notify = useNotify();
  const [isEditing, setIsEditing] = useState(false);
  const [postingFrequency, setPostingFrequency] = useState(
    (thinkpagesAccount as any).postingFrequency || ""
  );
  const [politicalLean, setPoliticalLean] = useState(
    (thinkpagesAccount as any).politicalLean || ""
  );
  const [personality, setPersonality] = useState((thinkpagesAccount as any).personality || "");

  const handleSave = async () => {
    try {
      await updateThinkpagesAccountMutation.mutateAsync({
        accountId: thinkpagesAccount.id,
        postingFrequency: postingFrequency as "active" | "moderate" | "low",
        politicalLean: politicalLean as "left" | "center" | "right",
        personality: personality as "serious" | "casual" | "satirical",
      });
      notify.success("Thinkpages settings updated!");
      setIsEditing(false);
      onRefetch();
    } catch (error: any) {
      notify.error(error.message || "Failed to update Thinkpages settings");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPostingFrequency((thinkpagesAccount as any).postingFrequency);
    setPoliticalLean((thinkpagesAccount as any).politicalLean);
    setPersonality((thinkpagesAccount as any).personality);
  };

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <TextureOverlay texture="scatteredDots" opacity={0.03} />
        <div className="relative z-10 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Thinkpages Persona
              </h2>
            </div>
          </div>
          <div>
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={updateThinkpagesAccountMutation.isPending}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                </button>
                <button
                  onClick={handleCancel}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-600 transition-all hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="glass-interactive flex items-center gap-2 rounded-xl bg-white/50 px-4 py-2 text-sm font-semibold text-indigo-600 transition-all hover:bg-white dark:bg-slate-800/50 dark:text-indigo-400 dark:hover:bg-slate-800"
              >
                Configure
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <label className="mb-2 block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Engagement Cadence
            </label>
            {isEditing ? (
              <Select value={postingFrequency} onValueChange={setPostingFrequency}>
                <SelectTrigger className="border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent className="glass-modal">
                  <SelectItem value="active">High Output</SelectItem>
                  <SelectItem value="moderate">Balanced</SelectItem>
                  <SelectItem value="low">Subtle</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-bold text-slate-900 capitalize dark:text-white">
                {postingFrequency}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <label className="mb-2 block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Ideological Pivot
            </label>
            {isEditing ? (
              <Select value={politicalLean} onValueChange={setPoliticalLean}>
                <SelectTrigger className="border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80">
                  <SelectValue placeholder="Lean" />
                </SelectTrigger>
                <SelectContent className="glass-modal">
                  <SelectItem value="left">Progressive</SelectItem>
                  <SelectItem value="center">Neutral</SelectItem>
                  <SelectItem value="right">Traditional</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-bold text-slate-900 capitalize dark:text-white">
                {politicalLean}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
            <label className="mb-2 block text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Output Modality
            </label>
            {isEditing ? (
              <Select value={personality} onValueChange={setPersonality}>
                <SelectTrigger className="border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/80">
                  <SelectValue placeholder="Modality" />
                </SelectTrigger>
                <SelectContent className="glass-modal">
                  <SelectItem value="serious">Analytic</SelectItem>
                  <SelectItem value="casual">Conversational</SelectItem>
                  <SelectItem value="satirical">Provocative</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-bold text-slate-900 capitalize dark:text-white">
                {personality}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-purple-500/5 p-4 dark:bg-purple-500/10">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Your Thinkpages persona dictates how our autonomous systems generate content on your
            behalf. These settings influence public perception across the Ixnay network.
          </p>
        </div>
      </div>
    </div>
  );
}
