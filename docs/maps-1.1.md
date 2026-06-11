Tier 1 — Core Editing Engine (Must Have)
1. MapLibre-Geoman

This is probably your new foundation layer.

Features:

Vertex editing
Polygon reshaping
Drag vertices
Insert/remove vertices
Snapping
Rotate
Scale
Split polygons
Cut polygons
MultiPolygon support
GeoJSON support
Measurement tools

Essentially "QGIS Lite" inside MapLibre.

For nation/province editing this gives you 80% of what you need immediately.

2. Terra Draw

Excellent if you want full control.

Supports:

Points
Lines
Polygons
Rectangles
Circles
Cross-library architecture

Works cleanly with MapLibre and can be extended with your own editing modes.

I would use Terra Draw if:

You want complete ownership of UX
You are building custom geopolitical editing workflows

instead of generic GIS editing.

Tier 2 — Advanced Geometry Operations
3. maplibre-gl-geo-editor

This is extremely interesting for IxMaps.

Adds:

Polygon union
Polygon difference
Polygon split
Simplification
Lasso selection
Feature duplication
Scale operations

Think:

Merge two provinces into one.

Split a province into multiple provinces.

Simplify coastlines.

Create autonomous regions.

These are exactly the workflows you'd need for nation-building.

4. Turf.js

Absolute requirement.

Use for:

Union
Difference
Buffer
Simplify
Dissolve
Intersect
Area calculations
Boundary generation
Coastline smoothing

Almost every GIS editor uses similar geometry operations under the hood.

Tier 3 — High-End Editing
5. Nebula.gl

If IxMaps eventually becomes:

Cities with millions of vertices
Massive historical maps
Province editing at continental scale

Nebula becomes very attractive.

Features:

100k+ feature editing
High-performance editing
Intermediate vertex insertion
Extrusion
Scaling
Advanced edit modes
Deck.gl integration

This is basically the "professional GIS editor" option.

I wouldn't start here.

I would keep it in mind for IxMaps v3.

What I'd Build For IxMaps
Forge Mode

Think of it as:

MapLibre + Geoman + Turf + Custom Tools

Tools panel:

Select
Select feature
Multi-select
Lasso select
Border Tools
Add vertex
Delete vertex
Move vertex
Smooth border
Simplify border
Snap border
Province Tools
Split province
Merge provinces
Transfer territory
Create exclave
Create enclave
Nation Tools
Annex territory
Cede territory
Draw claims
Draw disputed zones
Generate borders from claims
Water Tools
EEZ generation
Maritime boundary creation
River drawing
Lake generation
Infrastructure Tools
Highway editor
Rail editor
Shipping lanes
Flight corridors
Terrain Tools
Paint biome
Paint climate
Paint elevation zones
Features Most GIS Editors Don't Have (But IxMaps Should)
Border Brush

Paint territory.

Like Photoshop but for provinces.

Drag mouse:

Province A gains land
Province B loses land

Automatically rebuilds geometry.

Smart Border Following

Click:

Follow coastline

Follow river

Follow mountain range

Automatically generates vertices.

Historical Timeline Editing

Every geometry gets:

validFrom
validTo

Then:

2033
2040
2050
2100

slider

Map changes over time.

This would be an enormous differentiator.

Topology Rules

The biggest thing most custom map editors miss.

Example:

If Province A and Province B share a border:

A border changes

Then

B border changes automatically

No gaps.

No overlaps.

No slivers.

This is how professional GIS systems work.

I'd strongly recommend building a topology layer early because IxStates will eventually have:

Countries
Provinces
Counties
Cities
Districts

and maintaining shared borders manually becomes impossible.

My Recommended Stack

For an IxMaps roadmap:

Phase 1

MapLibre
MapLibre-Geoman
Turf.js

Phase 2

maplibre-gl-geo-editor
Topology engine
Border brush
Province merge/split

Phase 3

deck.gl
Nebula.gl
Historical timeline editing
Massive dataset optimization

That combination gets you surprisingly close to a browser-based version of QGIS or ArcGIS Pro, but tailored specifically for nation simulation, worldbuilding, and the IxStates ecosystem.

what are some other killer map editor features and world editor (admin map editor)

The mistake most worldbuilding projects make is building a map editor.

What you actually want is a World Operating System where the map is just one view into the world's data.

For IxMaps / Forge Mode, I'd divide features into 5 layers:

1. Territory & Border Engineering

This is the obvious stuff, but you can push it much further.

Border Brush

Paint territory like Photoshop.

Territory Gain
Territory Loss
Province Expansion
Province Shrink

No manual vertex dragging.

Border Warp

Grab a section of border and pull.

Think Liquify Tool in Photoshop.

Use cases:

Smooth ugly borders
Fix coastlines
Adjust regions quickly
Smart Border Generation

Generate borders from:

Rivers
Mountain ranges
Roads
Latitude/Longitude
Watersheds

Click:

Generate Border
Source: River

Done.

Province Generator

Select a state.

Generate:

Counties
Districts
Municipalities

using:

population
terrain
rivers
equal area
custom weighting
Border History

Every border change stored.

2040
Province Created

2045
Territory Annexed

2052
County Split

Complete undo/redo through history.

2. Geographic Intelligence

Where things become interesting.

Population Heatmap

Live overlay.

See:

density
growth
migration
Economic Heatmap

Show:

GDP
wealth
trade
productivity

per tile.

Almost like a strategy game.

Cultural Overlay

Visualize:

language
ethnicity
religion
customs

as gradients.

Political Overlay

Show:

voting patterns
ideology
approval
unrest
Strategic Overlay

Generate:

chokepoints
trade hubs
military value

automatically.

3. Infrastructure Engineering

Most map systems stop at borders.

This is where IxMaps can become unique.

Road Designer

Similar to city builders.

Draw roads.

Automatically calculate:

distance
travel time
traffic
Rail Designer

Generate:

passenger rail
freight rail
high-speed rail

with route optimization.

Shipping Routes

Visual editor for:

trade routes
shipping lanes
canals
Aviation Routes

Like FlightRadar but editable.

Create:

air corridors
airline networks
military routes
Utility Networks

Draw:

power grids
pipelines
fiber networks
water systems

Most nation sims never do this.

4. Terrain & Worldbuilding

This is where Forge Mode becomes dangerous.

Biome Painter

Paint:

forest
tundra
desert
jungle
wetlands

Like a game engine.

Climate Simulator

Input:

ocean currents
elevation
latitude

Generate:

rainfall
temperature
climate zones
River Generator

Click source.

AI generates:

tributaries
watersheds
drainage basins

following terrain.

Coastline Refinement

One-click:

Smooth
Naturalize
Erode
Deposit

Creates realistic coasts.

Terrain Sculpting

Brushes:

raise terrain
lower terrain
flatten terrain

For future 3D IxEarth.

5. World Administration Layer

This is the killer category.

Province Inspector

Click province.

Instant panel:

Population
GDP
Government
Governor
Capital
Military
Infrastructure
Budget

No separate pages.

Entity Creation Wizard

Click map.

Create:

nation
province
city
company
airport
military base

directly from map.

Bulk Edit

Select 200 provinces.

Change:

Owner
Tax Rate
Color
Government
Region

once.

World Diff System

Like Git.

Compare
2033 vs 2040

See:

borders changed
cities added
GDP changes