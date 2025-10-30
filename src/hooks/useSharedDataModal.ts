/**
 * useSharedDataModal Hook
 *
 * Simple state management hook for controlling the shared data modal visibility.
 * Manages which embassy's shared data is currently being viewed.
 *
 * @returns Modal state and control functions
 */

import { useState } from "react";

interface UseSharedDataModalReturn {
  showSharedData: string | null;
  openModal: (embassyId: string) => void;
  closeModal: () => void;
}

export function useSharedDataModal(): UseSharedDataModalReturn {
  const [showSharedData, setShowSharedData] = useState<string | null>(null);

  const openModal = (embassyId: string) => {
    setShowSharedData(embassyId);
  };

  const closeModal = () => {
    setShowSharedData(null);
  };

  return {
    showSharedData,
    openModal,
    closeModal,
  };
}
