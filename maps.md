What I think IxMaps needs
Level 1: Snap Everything

Every vertex should support:

Vertex Snap
Snap Distance = 10px

Moving a point near another point:

snap

instead of creating a new vertex.

Edge Snap

Border follows neighboring edge.

Prevents:

| |

becoming

| /

and creating micro gaps.

River Snap

For provinces generated from rivers.

Coastline Snap

For maritime regions.

Level 2: Topology Validation

Add a validator.

Every save:

validateMap()

checks:

Gap Detection

Find:

Province A
      gap
Province B

Highlight red.

Overlap Detection

Find:

AAAAA
 BBBBB

Show overlap polygon.

Self Intersection

Find bow-tie polygons.

\ /
 X
/ \

Invalid.

Detached Islands

Find accidental tiny polygons.

Duplicate Vertices

Find:

v1
v2
v3
v3
v4

Clean automatically.

Level 3: Province Adjacency Graph

Store:

Province {
  id
  neighbors:[]
}

Example:

Pescorto.neighbors = [
  "Novetra",
  "Childa",
  "Belatium"
]

Whenever borders change:

Update graph.

This unlocks:

diplomacy
pathfinding
military movement
trade

later.

Level 4: Border Simplification Tools

A lot of weird borders come from over-editing.

Add:

Smooth Border

Uses Chaikin smoothing.

50%
75%
100%
Simplify Border

Douglas-Peucker.

Removes excess vertices.

Naturalize Border

My favorite.

Takes:

jagged

and produces:

organic

using noise.

Great for coastlines.

Level 5: Shared Border Editing

This is the killer feature.

Current workflow:

Edit Pescorto

Problem:

Only Pescorto changes.

Instead:

Edit Shared Border

Select edge.

Editor shows:

Pescorto ↔ Novetra

Move vertices.

Both provinces update simultaneously.

This is how I'd build Forge.

Level 6: Territory Brush

Honestly I'd use this more than vertex editing.

Tool:

Paint Territory

Brush size:

10km
25km
50km

Paint into neighboring province.

System:

Calculates new geometry
Rebuilds borders
Validates topology
Updates adjacency

No manual vertex management.

Level 7: Automatic Repair

A button:

Repair Geometry

Runs:

remove duplicates
remove overlaps
snap nearby vertices
rebuild shared edges
simplify tiny slivers

QGIS has similar repair workflows.

The Architecture I'd Move Toward

Right now you probably have:

Province {
  geometry: Polygon
}

Move toward:

Vertex
Edge
Face

Topology model.

Vertex
 ├─ Edge
 ├─ Edge

Edge
 ├─ Province A
 ├─ Province B

Province
 ├─ Edge
 ├─ Edge
 ├─ Edge

This is essentially how CAD, GIS, and game map editors avoid the exact Pescorto-style problems you're seeing.




Core Map Engine
MapLibre GL JS

Your foundation.

Features:

Vector tiles
Custom projections
Terrain
Globe
WebGL rendering
Massive datasets
react-map-gl (MapLibre mode)

Best React integration.

Benefits:

Hooks
Declarative layers
Better React patterns
Deck.gl integration
Geometry Editing
1. MapLibre-Geoman

Highest priority.

Provides:

Vertex editing
Polygon editing
Snapping
Cut
Split
Rotate
Scale
Measurements

Closest thing to ArcGIS editing inside MapLibre.

2. Terra Draw

Modern drawing framework.

Supports:

Custom modes
Polygon editing
Selection
Snapping

Very extensible.

3. Mapbox GL Draw (MapLibre Compatible Forks)

Old but battle-tested.

Still useful for:

Feature editing
Selection
Basic geometry operations
GIS Operations
4. Turf.js

Mandatory.

You'll use it everywhere.

Functions:

union
difference
intersect
dissolve
simplify
area
centroid
buffers

Examples:

merge provinces
split territory
find neighbors
calculate area
5. JSTS

JavaScript port of the GIS geometry engine used by many desktop GIS tools.

Provides:

topology operations
polygon repair
advanced geometry validation

Perfect for fixing Pescorto-style issues.

Topology / Shared Border Systems
6. TopoJSON Client

Very important.

Instead of storing:

Province A border
Province B border

stores:

Shared edge

This is how professional boundary datasets work.

7. TopoJSON Server

Converts GeoJSON to TopoJSON.

Great for preprocessing.

8. Martinez Polygon Clipping

Extremely fast.

Supports:

union
difference
intersection

Excellent for territory transfer operations.

Massive Dataset Rendering
9. deck.gl

If IxMaps grows into:

world map
millions of features
heatmaps
influence maps

you'll eventually want this.

Supports:

GPU rendering
100k+ features
spatial analysis
10. Nebula.gl

Professional editing layer built on deck.gl.

Features:

advanced editing
transform tools
scale
rotate
reshape

Think ArcGIS in React.

Spatial Indexing
11. RBush

Critical.

Provides:

fast feature lookup
hit testing
selection

Used everywhere.

12. Flatbush

Even faster for static datasets.

Perfect for:

provinces
cities
roads
Pathfinding / Infrastructure
13. Graphology

Store:

Cities
Roads
Railways
Ports

as graph networks.

Enables:

logistics
trade
shortest path
14. ngraph.graph

Alternative graph engine.

Excellent performance.

World Simulation Layers
15. H3 Hexagonal Grid System

One of the coolest additions.

Instead of storing everything as polygons:

Store simulation data in hexes.

Examples:

population
GDP
climate
migration

This unlocks SimCity-level simulation.

16. h3-js

JS implementation.

Works great with MapLibre.

Terrain
17. maplibre-contour

Generates contour lines.

Useful for:

terrain editing
military planning
geographic realism
18. martin

Vector tile server.

Very useful when IxMaps becomes huge.

Data Storage
19. GeoJSON-VT

Convert GeoJSON into vector tiles.

Huge performance gains.

20. PMTiles

Probably the future for IxMaps.

Benefits:

single file world datasets
CDN friendly
offline capable

Amazing for worldbuilding projects.

My "IxMaps Forge Stack"

If I were building Forge Mode today:

Editing
MapLibre
React Map GL
MapLibre-Geoman
Terra Draw
Geometry
Turf
JSTS
Martinez
Topology
TopoJSON
Shared-edge model
Performance
RBush
GeoJSON-VT
PMTiles
Future
deck.gl
Nebula.gl
H3