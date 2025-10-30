"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import type { EnhancedInputProps } from "./types";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<any>;
  disabled?: boolean;
}

interface GlassSelectBoxProps extends Omit<EnhancedInputProps, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  multiSelect?: boolean;
  icon?: React.ComponentType<any>;
  maxHeight?: number;
}

export function GlassSelectBox({
  value,
  onChange,
  options,
  label,
  description,
  sectionId,
  theme,
  size = "md",
  disabled = false,
  required = false,
  placeholder = "Select an option...",
  searchable = false,
  multiSelect = false,
  icon: Icon,
  maxHeight = 200,
  className,
}: GlassSelectBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  const sizeClasses = {
    sm: "text-sm px-3 py-2 h-10",
    md: "text-base px-4 py-3 h-12",
    lg: "text-lg px-5 py-4 h-14",
  };

  // Filter options based on search
  const filteredOptions = searchable
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          option.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Get selected option
  const selectedOption = options.find((option) => option.value === value);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          const option = filteredOptions[highlightedIndex];
          if (option && !option.disabled) {
            onChange(option.value);
            setIsOpen(false);
            setSearchQuery("");
            setHighlightedIndex(-1);
          }
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        }
        break;
    }
  };

  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return;

    onChange(option.value);
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative space-y-2", className)}
      style={cssVars as React.CSSProperties}
    >
      {/* Label and Description */}
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              {required && <span className="text-red-400">*</span>}
            </label>
          )}
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      )}

      {/* Select Button */}
      <motion.button
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className={cn(
          "relative flex w-full items-center justify-between text-left",
          getGlassClasses("elevated", resolvedTheme, sectionId),
          "border-2 bg-white/80 dark:bg-gray-800/90",
          "border-gray-200/50 dark:border-gray-600/50",
          "hover:border-gray-300/70 dark:hover:border-gray-500/70",
          "focus:border-[var(--primitive-primary)] focus:shadow-lg",
          "focus:shadow-[var(--primitive-primary)]/20",
          sizeClasses[size],
          isOpen &&
            "border-[var(--primitive-primary)] shadow-[var(--primitive-primary)]/20 shadow-lg",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {/* Background Gradient */}
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 transition-opacity"
          style={{
            background: `linear-gradient(135deg, ${colors.background}, transparent)`,
          }}
          animate={{ opacity: isOpen ? 1 : 0 }}
        />

        <div className="relative flex min-w-0 flex-1 items-center gap-3">
          {selectedOption?.icon && (
            <selectedOption.icon className="h-4 w-4 flex-shrink-0 text-[var(--primitive-primary)]" />
          )}

          <div className="min-w-0 flex-1">
            {selectedOption ? (
              <div>
                <span className="text-foreground font-medium">{selectedOption.label}</span>
                {selectedOption.description && (
                  <p className="text-muted-foreground truncate text-xs">
                    {selectedOption.description}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-2 flex-shrink-0"
        >
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        </motion.div>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute top-full right-0 left-0 z-50 mt-1",
              getGlassClasses("modal", resolvedTheme, sectionId),
              "bg-white/95 dark:bg-gray-800/95",
              "border border-gray-200/50 dark:border-gray-600/50",
              "overflow-hidden rounded-lg shadow-xl"
            )}
            style={{ maxHeight }}
          >
            {/* Search Input */}
            {searchable && (
              <div className="border-b border-gray-200/50 p-3 dark:border-gray-600/50">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="text-foreground placeholder:text-muted-foreground w-full rounded-md border border-gray-200/50 bg-transparent py-2 pr-3 pl-10 text-sm focus:border-[var(--primitive-primary)] focus:outline-none dark:border-gray-600/50"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="text-muted-foreground px-4 py-3 text-center text-sm">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionClick(option)}
                    disabled={option.disabled}
                    whileHover={{ backgroundColor: `${colors.primary}10` }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      "hover:bg-[var(--primitive-primary)]/10",
                      index === highlightedIndex && "bg-[var(--primitive-primary)]/10",
                      option.disabled && "cursor-not-allowed opacity-50",
                      option.value === value && "bg-[var(--primitive-primary)]/20"
                    )}
                  >
                    {option.icon && (
                      <option.icon className="h-4 w-4 flex-shrink-0 text-[var(--primitive-primary)]" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-foreground text-sm font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-muted-foreground truncate text-xs">
                          {option.description}
                        </div>
                      )}
                    </div>

                    {option.value === value && (
                      <Check className="h-4 w-4 flex-shrink-0 text-[var(--primitive-primary)]" />
                    )}
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
