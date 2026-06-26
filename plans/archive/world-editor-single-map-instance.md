# World Editor: Single Persistent MapLibre Instance

Goal: stop tearing down + rebuilding the MapLibre map when toggling view ↔ border_edit.

## Root cause
`MapEditorOverlay.tsx` lines ~668–697 swap `<MapContainer>` (view) and `<BorderEditorMap>`
(border_edit). React unmounts one and mounts the other → each calls `map.remove()`
(IxWorldMap.tsx:331, BorderEditorMap.tsx:425) → full reload each switch.

Projection: both are mercator already, so NO projection swap needed (key enabler).

## Plan (incremental, each step shippable)
1. MapContainer.tsx — add `onMapReady?(map)`; fire from existing `onReady` via
   `mapRef.current?.getMap()`; fire `null` on unmount. No behavior change.
2. NEW src/components/maps/editor/hooks/useBorderEditorLayers.ts — port BorderEditorMap's
   sources/layers/handlers/effects (lines 148–659) into a hook that ATTACHES to the passed-in
   map when `isActive` and DETACHES (map.off + removeLayer/removeSource, re-enable dragPan,
   reset cursor) when not — never calls map.remove(). Use NAMED handlers for clean teardown.
   Drop the duplicate useMapLayers context layers (world map already renders rivers/lakes).
3. MapEditorOverlay.tsx — in world mode render `<MapContainer onMapReady={setSharedMap} />`
   UNCONDITIONALLY (both modes); delete the `<BorderEditorMap>` branch + its dynamic import.
   Mount `useBorderEditorLayers({ map: sharedMap, isActive: activeEditorMode==='border_edit', ...})`.
   No-op country select during edit: `onCountrySelect={activeEditorMode==='border_edit' ? ()=>{} : handleMapSelect}`.
4. Verify all interactions (vertex drag/snap, midpoint add, split line, trace, merge target,
   brush w/ dragPan disable, fitBounds-on-enter; view: country click, layer toggles, capitals).
5. Delete BorderEditorMap.tsx.

## Risks
- Teardown completeness (highest): every `map.on` needs a matching `map.off` w/ named ref.
- Event precedence: world map's own click/hover handlers still fire during edit (country
  select no-op handles selection; cursor may need gating).
- Style-loaded timing: handle map already-loaded vs loading (`isStyleLoaded()` else `once('styledata')`).
- Source id collisions: keep border-edit source ids unique (neighbors/active-feature/vertices/etc).
No true blockers.

## STATUS: DONE (v2)
Implemented: MapContainer.onMapReady + disableCountrySelect; new useBorderEditorLayers hook; MapEditorOverlay renders one persistent MapContainer for both modes; BorderEditorMap.tsx deleted. Lint clean. Needs runtime verification of all border interactions.
