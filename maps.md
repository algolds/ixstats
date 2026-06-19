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

I think you're actually onto a much bigger product than "flight paths."

What FlightCN accidentally demonstrates is that routes themselves can be first-class entities.

For IxMaps, I'd create an entire subsystem:

Routes

A network visualization and infrastructure editor for:

Airlines
Railways
Highways
Shipping lanes
Ferries
Pipelines
Power grids
Fiber networks
Military logistics
Trade corridors
Existing Libraries Worth Looking At
flightcn

The obvious inspiration.

Provides:

airport markers
route arcs
multi-stop journeys
route networks
animations
globe support

Perfect starting point for aviation.

React Flow

This is probably the most important non-map library.

Why?

Because a transportation network is just:

Node
  ↕
Edge
  ↕
Node

Airports.

Cities.

Ports.

Rail stations.

Highway interchanges.

React Flow already solves:

connections
node editing
edge editing
grouping
selection
contextual menus

I'd use React Flow concepts heavily even if you never render it directly on the map.

deck.gl ArcLayer

This is what many airline maps use.

Creates:

great-circle arcs
curved connections
animated paths

Perfect for:

Buffalo → Toronto
Paris → Rome
Venceia → Novetra
deck.gl TripsLayer

One of the coolest layers available.

Animates movement.

Examples:

aircraft
trains
ships
military units

You literally watch things move across the map.

deck.gl PathLayer

For highways and rail.

Supports:

custom widths
styling
dashed lines
GPU rendering

Can handle huge route networks.

Graphology

Treat the world as a graph.

Airport
RailStation
Port
City

connected by:

FlightRoute
RailRoute
Highway
ShippingLane

Enables:

shortest path
logistics
trade
route planning
Cosmograph

Extremely interesting.

Designed for huge relationship networks.

Imagine:

World Trade Network

visualized as a graph.

Could power:

trade routes
airline alliances
diplomatic networks
shipping networks

Reagraph

Another graph visualization engine.

Useful for:

transportation networks
logistics systems
trade visualization

Supports thousands of nodes smoothly.

Features Apple Would Build

The biggest opportunity is not copying GIS tools.

It's copying Apple Maps.

Route Cards

When clicking a route:

Northern Imperial Railway
────────────────────

Length
1,842 km

Stations
42

Passengers
4.3M/year

Owner
Imperial Rail Authority

Beautiful sheet UI.

Dynamic Route Styling

Air:

Blue Arc

Rail:

Solid Purple

Highway:

Orange

Shipping:

Teal Dotted

Power:

Yellow Glow

Fiber:

White Dashed
Route Builder

Instead of drawing lines.

Create:

New Route

Then:

Select Origin
Select Destination

System computes geometry.

Much cleaner UX.

Route Templates

One of the coolest concepts.

Create:

High-Speed Rail

Template:

{
  "speed": 350,
  "capacity": 1200,
  "electrified": true
}

Then apply anywhere.

Route Inspector

Click route.

See:

Properties
Capacity
Ownership
Traffic
Revenue
Travel Time
Maintenance

Like Apple Maps + Figma inspector.

Route Network View

Instead of showing individual routes:

Show network.

Example:

Imperial Airways

Visualize:

hubs
spokes
destinations

Like airline route maps.

Route Timeline

This feels very IxStates.

2033
2040
2050
2060

Watch:

railways appear
highways expand
airlines launch routes

in real time.

My Dream IxMaps "Routes" Architecture
Routes
├── Aviation
│   ├── Airports
│   ├── Airlines
│   ├── Flight Paths
│
├── Rail
│   ├── Stations
│   ├── Rail Lines
│   ├── High-Speed Rail
│
├── Road
│   ├── Cities
│   ├── Highways
│   ├── Logistics Corridors
│
├── Maritime
│   ├── Ports
│   ├── Shipping Routes
│   ├── Ferries
│
├── Utilities
│   ├── Power Grid
│   ├── Pipelines
│   ├── Fiber
│
└── Military
    ├── Supply Routes
    ├── Air Corridors
    ├── Naval Routes

The combination I'd pursue is:

FlightCN (visual inspiration) + Deck.gl Arc/Path/Trips Layers + Graphology + React Flow concepts + Apple Maps interaction patterns