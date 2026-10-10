---
title: Editing Your Territory
description: Add cities, provinces, landmarks, routes and labels to your nation on the map.
badge: MyCountry
prevHref: /help/mycountry/editor
prevLabel: The Country Editor
---

## What the map editor is for

The map editor lets you fill in your own nation on the world map: cities, provinces and other subdivisions, points of interest, named peaks, rivers and lakes, map labels, story pins and transport routes. You can open it in place on [IxMaps](/maps), or full-screen at [/mycountry/map-editor](/mycountry/map-editor) (also linked from the **Editor** toggle and the **Territory** card in MyCountry).

You can only edit the nation you own. National borders and coastlines are maintained by the map admins.

## How to open it

1. Go to [/maps](/maps) while signed in, with a nation.
2. Choose **Edit Map** in the map controls (or **Edit Map** on your nation's overview panel, or the edit button on the Territory card in MyCountry).
3. The editor opens over the map with a toolbar of tools. The guide button in the editor header walks you through the tools.

## What you can add and edit

| Feature | Notes |
| --- | --- |
| Cities | Place, move, rename and delete cities; set population and mark your capital |
| Provinces / subdivisions | Draw regions inside your borders (drawings are clipped to your territory); set their details |
| Points of interest | Landmarks, historic sites, bases and similar |
| Peaks, rivers and lakes | Name natural features so they appear in your geography report |
| Transport routes | Draw roads, rail and sea routes, or generate routes between your cities |
| Labels and story pins | Place names on the map, and pins that tell a story at a location |

Snapping helps new shapes line up with borders, coastlines and rivers; you can switch snapping per layer in the editor settings.

The editor also has helpers for cities: scatter cities across a region, create a capital in every region that has none, and snap a city to its region border or the coastline. Selecting several regions lets you change their type, level, colour or government type in one go, and the gap highlighter (**H**) shows empty areas you can turn into a region.

## Saving, undo and deleting

- The status bar shows **Saving…**, **Unsaved** or when you last saved. Your browser warns you before you close or reload the page with unsaved work.
- A placement or drawing you haven't saved is kept in your browser and offered back the next time you open the editor for that country.
- **Undo** (Ctrl/⌘+Z) and **Redo** (Ctrl/⌘+Shift+Z) cover every edit, including moves and bulk changes; hover the buttons to see which step they will undo or redo.
- Deleting always asks first, and a delete can be undone.
- When you reshape a region, neighbouring regions that share the moved corners move with it. **Save** keeps the change as one undo step; **Cancel** throws it away.

## Finding and moving around

- Search the feature list by name; press **Enter** to zoom to the first match. You can also select everything in a layer, or right-click a feature and choose **Zoom To**.
- **Escape** steps back one level at a time: it closes an open menu, then cancels the drawing, then leaves the tool.
- Press **?** in the editor for the full list of keyboard shortcuts. The most useful: **V** select, **C** city, **R** region, **P** point of interest, **T** route, **Enter** finish a route or split, **Ctrl/⌘+J** duplicate, **G** grid, **F** hide or show panels.

## Import and export

Open the editor's **Settings** menu to export your features as GeoJSON or import a GeoJSON file (up to 20 MB). An import is a single undo step. **I** opens the province importer for SVG or PNG province maps.

## Linking to the wiki

The **Wiki** tab scans your features for matching IxWiki pages, lets you link them in one click, and lists places where the map and the wiki disagree.

## How your map data is used

- Your cities and subdivisions show on the map and on your country profile for everyone.
- Transport routes feed a small effect into your economy.
- In your nation's geography settings you can choose whether national population and GDP come from your own national figures, from the sum of your subdivisions, or a mix of both.

## Common questions

**My border is wrong. Can I fix it?** Not yourself. Border changes are made by map admins; ask on the [Forum](/thinkpages) or a realm board.

**Why can't I see Edit Map?** You need to be signed in and own a nation on the map you're viewing.
