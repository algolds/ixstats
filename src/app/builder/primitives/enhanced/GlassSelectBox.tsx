"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NavArrowDown as ChevronDown, Check, Search } from "iconoir-react";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { tweenFast } from "~/lib/design/motion";
import type { EnhancedInputProps } from "./types";
import { Input } from "~/components/ui/input";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface GlassSelectBoxProps extends Omit<EnhancedInputProps, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
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
  icon: Icon,
  maxHeight = 200,
  className,
}: GlassSelectBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { cssVars } = useSectionTheme(sectionId, theme);

  const sizeClasses = {
    sm: "text-body px-3 py-2 h-10",
    md: "text-body px-4 py-3 h-12",
    lg: "text-title-3 px-5 py-4 h-14",
  };

  // Filter options based on search
  const filteredOptions = searchable
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          option.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

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
      {(label || description) && (
        <div className="space-y-1">
          {label && (
            <label className="text-label text-body flex items-center gap-2 font-medium">
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              {required && <span className="text-red">*</span>}
            </label>
          )}
          {description && <p className="text-label-secondary text-footnote">{description}</p>}
        </div>
      )}

      <motion.button
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "relative flex w-full items-center justify-between text-left",
          getGlassClasses("elevated"),
          "bg-surface border-2",
          "border-separator",
          "hover:border-label-tertiary",
          "focus-visible:border-tint focus-visible:shadow-floating",
          sizeClasses[size],
          isOpen && "border-tint shadow-floating",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="relative flex min-w-0 flex-1 items-center gap-3">
          {selectedOption?.icon && <selectedOption.icon className="text-tint h-4 w-4 shrink-0" />}

          <div className="min-w-0 flex-1">
            {selectedOption ? (
              <div>
                <span className="text-label font-medium">{selectedOption.label}</span>
                {selectedOption.description && (
                  <p className="text-label-secondary text-footnote truncate">
                    {selectedOption.description}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-label-secondary">{placeholder}</span>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-2 shrink-0"
        >
          <ChevronDown className="text-label-secondary h-4 w-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={tweenFast}
            className={cn(
              "z-popover absolute top-full right-0 left-0 mt-1",
              getGlassClasses("modal"),
              "material-thick",
              "border-separator border",
              "rounded-control shadow-floating overflow-hidden"
            )}
            style={{ maxHeight }}
          >
            {searchable && (
              <div className="border-separator border-b p-3">
                <div className="relative">
                  <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                  <Input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="text-label border-separator h-9 w-full bg-transparent py-1"
                  />
                </div>
              </div>
            )}

            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="text-label-secondary text-body px-4 py-3 text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionClick(option)}
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      "hover:bg-tint/10",
                      index === highlightedIndex && "bg-tint/10",
                      option.disabled && "cursor-not-allowed opacity-50",
                      option.value === value && "bg-tint/20"
                    )}
                  >
                    {option.icon && <option.icon className="text-tint h-4 w-4 shrink-0" />}

                    <div className="min-w-0 flex-1">
                      <div className="text-label text-body font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-label-secondary text-footnote truncate">
                          {option.description}
                        </div>
                      )}
                    </div>

                    {option.value === value && <Check className="text-tint h-4 w-4 shrink-0" />}
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
