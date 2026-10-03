import { useCallback, useEffect, useState } from "react";

/**
 * Visibility and tab state for a first-run guide dialog. Uncontrolled (`open` undefined) it opens
 * itself until `version` has been stored under `storageKey`; controlled it follows `open`.
 */
export function useWelcomeModal({
  open,
  onOpenChangeAction,
  storageKey,
  version,
}: {
  open?: boolean;
  onOpenChangeAction?: (open: boolean) => void;
  storageKey: string;
  version: string;
}) {
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (open !== undefined) {
      // oxlint-disable-next-line
      setShow(open);
      if (open) {
        setActiveTab(0);
      }
    }
  }, [open]);

  useEffect(() => {
    if (open === undefined) {
      try {
        if (localStorage.getItem(storageKey) !== version) {
          const timer = setTimeout(() => setShow(true), 800);
          return () => clearTimeout(timer);
        }
      } catch {
        // localStorage unavailable
      }
    }
    return;
  }, [open, storageKey, version]);

  const handleClose = useCallback(() => {
    setShow(false);
    onOpenChangeAction?.(false);
    try {
      localStorage.setItem(storageKey, version);
    } catch {
      // storage unavailable (private mode) — preference is not persisted
    }
  }, [onOpenChangeAction, storageKey, version]);

  return { show, activeTab, setActiveTab, handleClose };
}
