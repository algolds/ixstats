// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
import { useState, useCallback } from "react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";

interface UseProfileSettingsProps {
  userProfileCountryId?: string;
  userId?: string;
}

export function useProfileSettings({ userProfileCountryId, userId }: UseProfileSettingsProps) {
  const notify = useNotify();
  const [isEditingCountry, setIsEditingCountry] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [flagUploadMode, setFlagUploadMode] = useState(false);
  const [uploadedFlagUrl, setUploadedFlagUrl] = useState<string | null>(null);
  const [isUploadingFlag, setIsUploadingFlag] = useState(false);

  const updateCountryNameMutation = api.countries.update.useMutation();
  const updateCountryFlagMutation = api.countries.update.useMutation();

  const { refetch: refetchProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!userId,
  });

  const handleUpdateCountryName = useCallback(async () => {
    if (!userProfileCountryId || !newCountryName.trim()) return;

    try {
      await updateCountryNameMutation.mutateAsync({
        countryId: userProfileCountryId,
        name: newCountryName.trim(),
      });

      await refetchProfile();
      setIsEditingCountry(false);
      setNewCountryName("");
      notify.success("Country name updated successfully!");
    } catch (error) {
      console.error("Failed to update country name:", error);
      notify.error("Failed to update country name");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfileCountryId, newCountryName, updateCountryNameMutation, refetchProfile]);

  const handleFlagUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      notify.error("Please upload a valid image file (PNG, JPG, GIF, WEBP, or SVG)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.error("File size must be less than 5MB");
      return;
    }

    setIsUploadingFlag(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(withBasePath("/api/upload/image"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (result.success && result.url) {
        setUploadedFlagUrl(result.url);
        notify.success('Image uploaded! Click "Save Flag" to apply.');
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload flag:", error);
      notify.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingFlag(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFlagSave = useCallback(async () => {
    if (!userProfileCountryId || !uploadedFlagUrl) {
      notify.error("No flag to save");
      return;
    }

    try {
      await updateCountryFlagMutation.mutateAsync({
        countryId: userProfileCountryId,
        flag: uploadedFlagUrl,
      });

      await refetchProfile();
      setFlagUploadMode(false);
      setUploadedFlagUrl(null);
      notify.success("Flag saved successfully!");
    } catch (error) {
      console.error("Failed to save flag:", error);
      notify.error("Failed to save flag");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfileCountryId, uploadedFlagUrl, updateCountryFlagMutation, refetchProfile]);

  return {
    isEditingCountry,
    newCountryName,
    flagUploadMode,
    uploadedFlagUrl,
    isUploadingFlag,
    setIsEditingCountry,
    setNewCountryName,
    setFlagUploadMode,
    setUploadedFlagUrl,
    updateCountryNameMutation,
    updateCountryFlagMutation,
    handleUpdateCountryName,
    handleFlagUpload,
    handleFlagSave,
    refetchProfile,
  };
}
