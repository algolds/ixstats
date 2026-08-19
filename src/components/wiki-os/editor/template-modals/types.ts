"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
