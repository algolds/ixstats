#!/usr/bin/env tsx
/**
 * Fix missing useEffect imports
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function hasUseEffect(content: string): boolean {
  return content.includes("useEffect(");
}

function hasUseEffectImport(content: string): boolean {
  const importRegex = /import\s+\{[^}]*useEffect[^}]*\}\s+from\s+['"]react['"]/;
  return importRegex.test(content);
}

function addUseEffectToReactImport(content: string): string {
  const lines = content.split("\n");

  // Find React import and add useEffect
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match various React import patterns
    if (line.includes("from") && (line.includes('"react"') || line.includes("'react'"))) {
      if (line.includes("import React from")) {
        // Pattern: import React from "react";
        lines[i] = line.replace("import React from", "import React, { useEffect } from");
      } else if (line.includes("import {") && !line.includes("useEffect")) {
        // Pattern: import { useState, ... } from "react";
        lines[i] = line.replace(/\{([^}]+)\}/, (match, imports) => {
          const trimmed = imports.trim();
          return `{ useEffect, ${trimmed} }`;
        });
      }
      return lines.join("\n");
    }
  }

  // If no React import found, add after 'use client'
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("use client")) {
      lines.splice(i + 1, 0, "", 'import { useEffect } from "react";');
      return lines.join("\n");
    }
  }

  return content;
}

function fixAllFiles() {
  const rootDir = join(__dirname, "..", "src", "app");
  let fixed = 0;

  function scanDirectory(dir: string) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry === "page.tsx") {
        const content = readFileSync(fullPath, "utf-8");

        if (hasUseEffect(content) && !hasUseEffectImport(content)) {
          const fixedContent = addUseEffectToReactImport(content);
          writeFileSync(fullPath, fixedContent, "utf-8");
          console.log(`✅ Fixed: ${fullPath.replace(rootDir, "")}`);
          fixed++;
        }
      }
    }
  }

  scanDirectory(rootDir);

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixed} files`);
}

// Run fix
console.log("=== Fixing useEffect Imports ===\n");
fixAllFiles();
