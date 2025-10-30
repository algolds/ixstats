import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export function useThinkpagesSettings(user: any) {
  const [isEditingThinkpages, setIsEditingThinkpages] = useState(false);
  const [thinkpagesPostingFrequency, setThinkpagesPostingFrequency] = useState("");
  const [thinkpagesPoliticalLean, setThinkpagesPoliticalLean] = useState("");
  const [thinkpagesPersonality, setThinkpagesPersonality] = useState("");

  const {
    data: thinkpagesAccount,
    isLoading: thinkpagesAccountLoading,
    refetch: refetchThinkpagesAccount,
  } = api.thinkpages.getThinkpagesAccountByUserId.useQuery(
    { clerkUserId: user?.id || "placeholder-disabled" },
    { enabled: !!user?.id }
  );

  const updateThinkpagesAccountMutation = api.thinkpages.updateAccount.useMutation();

  useEffect(() => {
    if (thinkpagesAccount) {
      setThinkpagesPostingFrequency((thinkpagesAccount as any).postingFrequency);
      setThinkpagesPoliticalLean((thinkpagesAccount as any).politicalLean);
      setThinkpagesPersonality((thinkpagesAccount as any).personality);
    }
  }, [thinkpagesAccount]);

  const handleSaveThinkpagesSettings = async () => {
    if (!thinkpagesAccount) return;

    try {
      await updateThinkpagesAccountMutation.mutateAsync({
        accountId: thinkpagesAccount.id,
        postingFrequency: thinkpagesPostingFrequency as "active" | "moderate" | "low",
        politicalLean: thinkpagesPoliticalLean as "left" | "center" | "right",
        personality: thinkpagesPersonality as "serious" | "casual" | "satirical",
      });
      toast.success("Thinkpages settings updated!");
      setIsEditingThinkpages(false);
      refetchThinkpagesAccount();
    } catch (error: any) {
      toast.error(error.message || "Failed to update Thinkpages settings");
    }
  };

  const handleCancelThinkpagesEdit = () => {
    setIsEditingThinkpages(false);
    if (thinkpagesAccount) {
      setThinkpagesPostingFrequency((thinkpagesAccount as any).postingFrequency);
      setThinkpagesPoliticalLean((thinkpagesAccount as any).politicalLean);
      setThinkpagesPersonality((thinkpagesAccount as any).personality);
    }
  };

  return {
    isEditingThinkpages,
    setIsEditingThinkpages,
    thinkpagesPostingFrequency,
    setThinkpagesPostingFrequency,
    thinkpagesPoliticalLean,
    setThinkpagesPoliticalLean,
    thinkpagesPersonality,
    setThinkpagesPersonality,
    thinkpagesAccount,
    thinkpagesAccountLoading,
    updateThinkpagesAccountMutation,
    handleSaveThinkpagesSettings,
    handleCancelThinkpagesEdit,
  };
}
