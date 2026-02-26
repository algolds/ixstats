import { useState, useCallback } from "react";

export type SnapshotModalType =
  | "inbox"
  | "world-events"
  | "diplomatic-network"
  | "crisis-status"
  | null;

export function useDashboardSnapshotModals() {
  const [activeModal, setActiveModal] = useState<SnapshotModalType>(null);

  const openModal = useCallback((type: SnapshotModalType) => {
    setActiveModal(type);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  return { activeModal, openModal, closeModal };
}
