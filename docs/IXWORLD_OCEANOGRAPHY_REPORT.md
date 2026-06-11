# IxWorld Comprehensive Oceanography Report

*Prepared by the IxWorld Bureau of Oceanographic Sciences*
*Date: IxYear 2041 — Compiled from climate simulation data, geographic survey, and economic analysis*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Planetary Parameters & Scale](#2-planetary-parameters--scale)
3. [Ocean Basins](#3-ocean-basins)
4. [Major Seas & Marginal Water Bodies](#4-major-seas--marginal-water-bodies)
5. [Ocean Circulation & Current Systems](#5-ocean-circulation--current-systems)
6. [Wind Systems & Atmospheric Drivers](#6-wind-systems--atmospheric-drivers)
7. [Sea Surface Temperature & Climate Zones](#7-sea-surface-temperature--climate-zones)
8. [Key Ports & Maritime Infrastructure](#8-key-ports--maritime-infrastructure)
9. [Shipping Routes & Distance Tables](#9-shipping-routes--distance-tables)
10. [Optimal Route Analysis](#10-optimal-route-analysis)
11. [Shipping Time Calculations](#11-shipping-time-calculations)
12. [Strait & Chokepoint Analysis](#12-strait--chokepoint-analysis)
13. [Tidal Systems & Sea Level](#13-tidal-systems--sea-level)
14. [Marine Ecology Zones](#14-marine-ecology-zones)
15. [Appendices](#15-appendices)

---

## 1. Executive Summary

IxEarth is a terrestrial planet with a geography centered at approximately 56.18°E longitude. The planet features **four major ocean basins**, **18+ named seas**, and **six continents** (Levantia, Sarpedon, Audonia, Crona, Kiroborea, and Australis). The global ocean covers approximately 68% of the planetary surface, with a total estimated ocean area of ~347 million km².

The ocean circulation is driven by:
- **Atmospheric wind belts** (trade winds, westerlies, polar easterlies) governed by the Intertropical Convergence Zone (ITCZ)
- **Coriolis deflection** producing western boundary current intensification
- **Thermohaline circulation** connecting all four major basins in a global conveyor

This report provides quantitative analysis of distances, shipping times, optimal routes, and oceanographic conditions across IxEarth's maritime domain.

---

## 2. Planetary Parameters & Scale

### 2.1 Globe Specifications

| Parameter | Value |
|-----------|-------|
| Map projection | Globe (MapLibre GL JS) |
| Map center | 56.1842°E, 0°N |
| Coordinate system | Standard WGS84 (lat/lng) |
| Equatorial circumference | ~40,075 km (Earth-equivalent) |
| Meridional circumference | ~40,008 km |
| 1° latitude | ~111.32 km |
| 1° longitude (equator) | ~111.32 km |
| 1° longitude (45°N/S) | ~78.71 km |
| 1° longitude (60°N/S) | ~55.66 km |

### 2.2 Distance Formula (Haversine)

All distances in this report are computed using the Haversine formula:

```
a = sin²(Δφ/2) + cos(φ₁) · cos(φ₂) · sin²(Δλ/2)
c = 2 · atan2(√a, √(1-a))
d = R · c
```

Where:
- `φ₁, φ₂` = latitudes in radians
- `Δφ` = latitude difference
- `Δλ` = longitude difference
- `R` = 6,371 km (mean Earth radius)
- `d` = distance in kilometers

**Nautical conversion**: 1 nautical mile (nm) = 1.852 km; `d_nm = d / 1.852`

---

## 3. Ocean Basins

### 3.1 Levantine Ocean

| Property | Value |
|----------|-------|
| Central coordinates | 115°E, 32°N |
| Approximate extent | 70°E–160°E, 10°S–55°N |
| Estimated area | ~82 million km² |
| Average depth | ~3,800 m |
| Maximum depth | ~10,200 m (Levantine Trench) |
| Bordering continents | Audonia (west), Crona (east), Kiroborea (north) |

The Levantine Ocean is the largest and most commercially significant ocean basin on IxEarth. It separates the great landmasses of Audonia and Kiroborea from Crona, serving as the primary conduit for trans-oceanic trade between these continents.

**Key features:**
- **Western boundary current** (Dolong Current): Warm, fast-flowing current along the Audonian coast, analogous to the Gulf Stream. Flows northward from ~10°N to ~45°N at speeds of 1.5–2.5 m/s.
- **Levantine Gyre**: Clockwise subtropical gyre driven by trade winds (south) and westerlies (north), centered at approximately 115°E, 25°N.
- **Northern Counter-Gyre**: Subpolar counterclockwise gyre above ~45°N, bringing cold Kirobore waters southward along the eastern Cronan coast.
- **Equatorial Counter-Current**: Narrow eastward-flowing current between 2°N–8°N.

### 3.2 Odoneru Ocean

| Property | Value |
|----------|-------|
| Central coordinates | 15°W, 20°N |
| Approximate extent | 60°W–30°E, 30°S–60°N |
| Estimated area | ~65 million km² |
| Average depth | ~3,400 m |
| Maximum depth | ~8,700 m |
| Bordering continents | Levantia (east), Crona (west), Sarpedon (south) |

The Odoneru Ocean lies between Levantia and Crona, providing the primary maritime corridor connecting the northern Levantine powers to the western Cronan states. It is named after the ancient Odoneru peoples who first charted its currents.

**Key features:**
- **Levantine Current**: Warm current flowing NE along the Levantine coast from the tropics to ~55°N. Significant moderating effect on Levantine climate, enabling Temperate Oceanic (Do) conditions at latitudes that would otherwise be Boreal.
- **Cronan Coastal Current**: Cold southward-flowing current along western Crona, creating fog-prone conditions and upwelling zones rich in marine life.
- **Odoneru Subtropical Gyre**: Clockwise circulation in the Northern Hemisphere portion.
- **Tainean Counter-Gyre**: Southern Hemisphere counterclockwise gyre centered near the Tainean Sea.

### 3.3 Ocean of Cathay

| Property | Value |
|----------|-------|
| Central coordinates | 175°E, 30°S |
| Approximate extent | 140°E–130°W, 65°S–10°N |
| Estimated area | ~95 million km² |
| Average depth | ~4,100 m |
| Maximum depth | ~11,400 m (Cathayan Abyss) |
| Bordering continents | Crona (east), Australis (south), Audonia (northwest) |

The largest ocean basin by area, the Ocean of Cathay dominates the southern and eastern hemispheres. Its vast expanse creates the longest open-ocean passages on IxEarth, with crossing times exceeding 20 days for conventional cargo vessels.

**Key features:**
- **South Cathayan Current**: Cold circumpolar current flowing west-to-east around the southern polar regions, the strongest current system on IxEarth (~130 Sv transport).
- **Australis Warm Pool**: Region of elevated SST (>28°C) near Australis, driving tropical cyclone formation.
- **Pukhtun Upwelling Zone**: Cold, nutrient-rich upwelling along the eastern boundary, supporting major fisheries.
- **Great Expanse Doldrums**: Region of light and variable winds near 170°E, 5°S, historically dangerous for sailing vessels.

### 3.4 Absurian Ocean

| Property | Value |
|----------|-------|
| Central coordinates | 30°E, 62°S |
| Approximate extent | 10°W–70°E, 45°S–80°S |
| Estimated area | ~28 million km² |
| Average depth | ~3,600 m |
| Maximum depth | ~7,200 m |
| Bordering continents | Sarpedon (north), polar ice cap (south) |

The smallest and coldest of the four major oceans, the Absurian Ocean separates southern Sarpedon from the Antarctic ice cap. Seasonal sea ice extends to ~55°S in winter. Navigation is limited to the summer months (IxNovember–IxMarch) for most of the basin.

**Key features:**
- **Absurian Circumpolar Current**: Connects with the South Cathayan Current, forming a continuous circumpolar flow.
- **Polar Front**: Sharp thermal boundary at ~55°S where cold polar waters meet temperate Sarpedonian waters. SST drops from 8°C to 2°C across a few degrees of latitude.
- **Seasonal ice extent**: Pack ice reaches 50°S in winter, retreating to ~70°S in summer.
- **Founders Current**: Warm current flowing SW from Sarpedon into the Founders Sea, moderating coastal temperatures.

---

## 4. Major Seas & Marginal Water Bodies

### 4.1 Sea Catalog

| # | Sea | Center (lng, lat) | Rank | Approximate Area (km²) | Bordering Regions |
|---|-----|--------------------|------|------------------------|-------------------|
| 1 | Kilikas Sea | 25°E, 58°N | Medium | ~850,000 | Levantia (Gothica), Kiroborea |
| 2 | Sea of Nordska | 98°E, 52°N | Medium | ~1,200,000 | Kiroborea, northern Audonia (Dolong) |
| 3 | Sea of Capean | 160°E, 42°N | Medium | ~900,000 | Kiroborea (east), Crona (west) |
| 4 | Sea of Canete | 55°E, 9°S | Medium | ~600,000 | Audonia (south), Sarpedon approaches |
| 5 | Sea of Istroya | 85°E, 5°S | Medium | ~750,000 | Audonia (Daria), Australis approaches |
| 6 | Tainean Sea | 10°W, 12°S | Medium | ~550,000 | Sarpedon (Vallos), Crona (south) |
| 7 | Kindreds Sea | 8°W, 28°S | Medium | ~480,000 | Sarpedon (Taino-Kindreds) |
| 8 | Founders Sea | 80°E, 40°S | Medium | ~700,000 | Australis, southern Audonia |
| 9 | Pukhtun Sea | 145°E, 25°S | Medium | ~820,000 | Audonia (southeast), Cathay approaches |
| 10 | Great Expanse | 168°E, 5°S | Medium | ~1,100,000 | Open ocean, Crona approaches |
| 11 | Sea of St. John | 140°W, 15°N | Medium | ~950,000 | Western Crona (Cusinaut) |
| 12 | Albion Sea | 58°W, 55°N | Medium | ~680,000 | Western Levantia, eastern Crona |
| 13 | Sea of Orixtal | 110°W, 18°S | Medium | ~870,000 | Crona (south/west) |
| 14 | Polynesian Sea | 55°W, 30°S | Medium | ~780,000 | Crona (South Crona), Sarpedon |
| 15 | Okatian Sea | 70°W, 45°S | Minor | ~320,000 | Southern Crona |
| 16 | Barbary Straits | 115°E, 2°N | Minor | ~45,000 | Audonia chokepoint |

### 4.2 Notable Water Body Characteristics

**Kilikas Sea** — A semi-enclosed sea between Levantia and Kiroborea. Critical trade route connecting the heartland of Levantine civilization to Kiravian maritime commerce. The narrow entrance at its western end creates strong tidal currents (up to 3 knots). Average depth: 210 m. Winter ice formation above 62°N.

**Sea of Nordska** — Large marginal sea north of Audonia's Dolong region. Access point for Daxia, Metzetta, and Oyashima's northern trade routes. Subject to severe winter storms (IxNovember–IxFebruary). Average depth: 340 m.

**Sea of Canete** — Warm tropical sea between Audonia and the approach to southern continents. High biodiversity; major tuna and pelagic fisheries. Monsoon-influenced circulation reverses seasonally.

**Barbary Straits** — Narrow chokepoint at 115°E, 2°N. Only 85 km wide at the narrowest point. Handles ~35% of Levantine Ocean commerce. Current flows primarily westward at 1.2 knots, creating challenging navigation for eastbound vessels.

---

## 5. Ocean Circulation & Current Systems

### 5.1 Theoretical Framework

Ocean currents in IxWorld are driven by three primary mechanisms:

1. **Wind-driven (Ekman) circulation**: Surface currents deflected 45° from wind direction by Coriolis force
2. **Western boundary intensification** (Stommel theory): Currents are narrow and fast on western boundaries, broad and slow on eastern boundaries
3. **Thermohaline circulation**: Density-driven deep water formation at high latitudes

The wind-driven surface circulation follows:

```
τ_x = ρ_air · C_D · |W| · W_x    (wind stress, x-component)
τ_y = ρ_air · C_D · |W| · W_y    (wind stress, y-component)

M_E = τ / (ρ_water · f)           (Ekman transport)
f = 2Ω sin(φ)                     (Coriolis parameter)
```

Where:
- `ρ_air` = 1.225 kg/m³
- `C_D` = 1.3 × 10⁻³ (drag coefficient)
- `Ω` = 7.292 × 10⁻⁵ rad/s
- `φ` = latitude

### 5.2 Major Current Systems

#### 5.2.1 Levantine Ocean Currents

```
                    Kiroborea (60°N)
                         ↓
           ←←← Subpolar Easterlies ←←←
          ↓                              ↑
    Kirobore           Levantine      Cronan
    Cold Current       Subpolar       Coastal
    (southward)        Gyre (CCW)     (northward)
          ↓                              ↑
           →→→ Westerlies Belt →→→
          ↓                              ↑
    Dolong              Subtropical    Eastern
    Warm Current        Gyre (CW)     Counter
    (northward)                        (southward)
          ↑                              ↓
           ←←← NE Trade Winds ←←←
          ↑                              ↓
                    Equator (ITCZ)
```

| Current | Direction | Speed (knots) | Width (km) | Depth (m) |
|---------|-----------|---------------|------------|-----------|
| Dolong Warm Current | Northward | 2.0–3.5 | 80–120 | 800 |
| Kirobore Cold Current | Southward | 1.0–1.5 | 200–400 | 600 |
| Levantine Equatorial | Westward | 0.8–1.2 | 300 | 200 |
| Levantine Counter | Eastward | 0.5–0.8 | 150 | 100 |
| Northern Subpolar | Westward | 0.6–1.0 | 250 | 400 |

#### 5.2.2 Odoneru Ocean Currents

| Current | Direction | Speed (knots) | Width (km) | Depth (m) |
|---------|-----------|---------------|------------|-----------|
| Levantine Coast Current | NE-ward | 1.5–2.5 | 100–150 | 700 |
| Cronan Western Current | Southward | 0.8–1.2 | 150–300 | 500 |
| Odoneru Equatorial | Westward | 0.6–1.0 | 400 | 150 |
| Tainean Gyre | CCW | 0.4–0.8 | — | 300 |

#### 5.2.3 Ocean of Cathay Currents

| Current | Direction | Speed (knots) | Width (km) | Depth (m) |
|---------|-----------|---------------|------------|-----------|
| South Cathayan Circumpolar | Eastward | 0.8–1.5 | 500–800 | 4,000+ |
| Pukhtun Cold Current | Northward | 0.5–1.0 | 200 | 400 |
| Australis Warm Current | Southward | 1.0–1.8 | 120 | 600 |
| Cathayan Equatorial | Westward | 0.7–1.1 | 350 | 180 |

### 5.3 Western Boundary Intensification

The IxWorld climate simulation models western boundary current intensification using:

```
ψ = (τ₀ / (ρ · β · H)) · [1 - e^(-x/δ_w)] · sin(πy/L)

δ_w = (r / β)                    (western boundary layer thickness)
β = df/dy = 2Ω cos(φ) / R        (beta parameter)
```

This produces the characteristic narrow, fast currents on western ocean boundaries (Dolong Warm Current, Levantine Coast Current) and broad, slow return flows on eastern boundaries. The Dolong Warm Current transports approximately 45 Sv (1 Sv = 10⁶ m³/s), comparable to the real-world Gulf Stream.

---

## 6. Wind Systems & Atmospheric Drivers

### 6.1 Global Wind Belts

The IxWorld atmospheric circulation follows the standard three-cell model:

| Latitude Band | Wind Belt | Direction (surface) | Average Speed (knots) |
|---------------|-----------|--------------------|-----------------------|
| 0°–10°N/S | ITCZ Doldrums | Calm/variable | 2–5 |
| 10°–30°N | NE Trade Winds | NE → SW | 12–18 |
| 10°–30°S | SE Trade Winds | SE → NW | 12–18 |
| 30°–35°N/S | Horse Latitudes | Calm/variable | 3–8 |
| 35°–60°N | Prevailing Westerlies | SW → NE | 15–25 |
| 35°–60°S | Roaring Forties/Fifties | NW → SE | 18–30 |
| 60°–90°N/S | Polar Easterlies | NE/SE | 10–15 |

### 6.2 Wind Simulation Model

The climate system computes wind vectors using:

```
ITCZ_latitude = 5° · sin(season) + noise

// Base zonal wind (u-component)
u_base = -cos(3π · normalized_lat)    // Trade winds + westerlies

// Coriolis deflection
u_coriolis = u_base · sign(latitude)

// Pressure-driven modification (continental effects)
u_final = u_base + pressure_gradient · continental_factor
```

### 6.3 Monsoon Systems

**Audonian Monsoon** (Sea of Canete / Sea of Istroya region):
- Summer (IxMay–IxSeptember): SW winds bring moisture from Sea of Canete across Daria
- Winter (IxNovember–IxMarch): NE winds create dry season, current reversal in Sea of Canete
- Transition: April/October — variable winds, dangerous squalls

**Dolong Sea Monsoon** (Sea of Nordska region):
- Less pronounced than the southern monsoon
- Summer: Onshore SE winds; Winter: Offshore NW winds
- Affects Daxia, Oyashima, Metzetta coastal shipping

---

## 7. Sea Surface Temperature & Climate Zones

### 7.1 SST Distribution

Using the Trewartha climate classification and the IxWorld climate simulation:

| Zone | Latitude Range | SST Range (°C) | Climate Type |
|------|---------------|-----------------|--------------|
| Tropical | 0°–15°N/S | 26–30 | Ar, Aw |
| Subtropical | 15°–30°N/S | 20–27 | Cs, Cf |
| Temperate | 30°–50°N/S | 10–20 | Do, Dc |
| Subpolar | 50°–65°N/S | 2–10 | E |
| Polar | 65°–90°N/S | -2–2 | Ft, Fi |

### 7.2 Temperature Computation

```
T_base = 30 - 60 · |normalized_latitude|                    // ITCZ-centered baseline
T_continental = T_base - continentality · 15                 // Continental amplification
T_altitude = T_continental - elevation · lapse_rate          // Lapse rate: -6.5°C/km
T_final = T_altitude + ocean_current_anomaly + noise
```

### 7.3 Ocean Climate Interactions by Sea

| Sea | Avg SST (°C) | Climate Effect | Trewartha Coastal Zone |
|-----|-------------|----------------|----------------------|
| Kilikas Sea | 8–14 | Moderates Gothica winters | Do (Temperate Oceanic) |
| Sea of Nordska | 4–12 | Cold-air outbreaks in winter | Dc → E |
| Sea of Canete | 25–29 | Monsoon moisture source | Ar, Aw |
| Sea of Istroya | 24–28 | Tropical maritime | Aw, Cf |
| Tainean Sea | 22–27 | Moderate, stable | Cf, Cs |
| Kindreds Sea | 18–24 | Transitional | Cf |
| Barbary Straits | 27–30 | Hot, humid | Ar |
| Great Expanse | 26–29 | Deep tropics | Ar |
| Pukhtun Sea | 20–26 | Upwelling zone, cooler | Cs, Cf |
| Sea of St. John | 22–26 | Tropical/subtropical | Aw, Cf |
| Founders Sea | 12–18 | Southern temperate | Do, Dc |
| Albion Sea | 6–12 | Cool temperate | Do, E |
| Polynesian Sea | 16–22 | Warm temperate | Cf |
| Okatian Sea | 8–14 | Cool, stormy | Do, Dc |

---

## 8. Key Ports & Maritime Infrastructure

### 8.1 Major World Ports (by estimated throughput)

Ports are assigned estimated coordinates based on their country's continental position, coastline, and regional placement.

| # | Port | Country | Continent | Region | Est. Coordinates (lng, lat) | Annual Trade (est. $B) |
|---|------|---------|-----------|--------|---------------------------|----------------------|
| 1 | Port Urceopolis | Urcea | Levantia | Great Levantia | 28°E, 45°N | 2,840 |
| 2 | Caphiria City | Caphiria | Sarpedon | Latium | 15°E, 25°S | 2,550 |
| 3 | Kiravia Prime | Kiravia | Kiroborea | Great Kirav | 80°E, 60°N | 2,370 |
| 4 | Daxia Harbor | Daxia | Audonia | Dolong | 95°E, 18°N | 1,640 |
| 5 | Cartadania Port | Cartadania | Sarpedon | Taino-Kindreds | -5°E, -22°S | 1,830 |
| 6 | Fiannria Harbor | Fiannria | Levantia | Gallia Magna | 18°E, 50°N | 1,530 |
| 7 | Alstin Deepwater | Alstin | Crona | South Crona | -80°E, 20°N | 1,430 |
| 8 | Burgundie Port | Burgundie | Levantia | Great Levantia | 35°E, 42°N | 1,290 |
| 9 | Varshan Gateway | Varshan | Crona | Central Crona | -50°E, 5°N | 920 |
| 10 | Paulastra Harbor | Paulastra | Crona | South Crona | -70°E, -8°S | 770 |
| 11 | Tierrador Port | Tierrador | Crona | South Crona | -90°E, -30°S | 900 |
| 12 | Faneria Harbor | Faneria | Levantia | Gallia Magna | 10°E, 52°N | 1,260 |
| 13 | Pelaxia Terminal | Pelaxia | Sarpedon | Taino-Kindreds | -15°E, -30°S | 820 |
| 14 | Timbia Port | Timbia | Australis | Peratra | 105°E, -38°S | 430 |
| 15 | Oyashima Harbor | Oyashima | Audonia | Dolong | 110°E, 25°N | 480 |
| 16 | Kostava Port | Kostava | Sarpedon | Sarposlavia | 20°E, 10°S | 580 |
| 17 | Argyrea Harbor | Argyrea | Audonia | Daria | 72°E, 12°N | 530 |
| 18 | Metzetta Terminal | Metzetta | Audonia | Dolong | 100°E, 30°N | 400 |
| 19 | Castadilla Port | Castadilla | Sarpedon | Vallos | -25°E, -20°S | 470 |
| 20 | Canespa Harbor | Canespa | Crona | Cusinaut | -55°E, 12°N | 350 |

### 8.2 Port Classifications

**Tier 1 — Global Hub Ports** (>$1T annual trade): Urceopolis, Caphiria City, Kiravia Prime, Cartadania Port, Daxia Harbor, Fiannria Harbor, Alstin Deepwater, Burgundie Port, Faneria Harbor

**Tier 2 — Regional Hub Ports** ($500B–$1T): Varshan Gateway, Paulastra Harbor, Tierrador Port, Pelaxia Terminal, Kostava Port, Argyrea Harbor

**Tier 3 — National Ports** ($250B–$500B): Timbia Port, Oyashima Harbor, Metzetta Terminal, Castadilla Port, Canespa Harbor

---

## 9. Shipping Routes & Distance Tables

### 9.1 Methodology

All distances computed via the Haversine formula with waypoints for routes that must navigate around landmasses. Direct great-circle distances shown alongside routed distances.

### 9.2 Inter-Continental Distance Matrix (Nautical Miles)

Distances between major ports via optimal shipping routes:

| From \ To | Urceopolis | Caphiria City | Kiravia Prime | Daxia Harbor | Alstin DW | Cartadania Pt |
|-----------|-----------|--------------|--------------|-------------|----------|--------------|
| **Urceopolis** | — | 4,120 | 2,850 | 4,680 | 6,320 | 4,580 |
| **Caphiria City** | 4,120 | — | 5,830 | 6,250 | 5,940 | 1,680 |
| **Kiravia Prime** | 2,850 | 5,830 | — | 2,420 | 7,810 | 6,940 |
| **Daxia Harbor** | 4,680 | 6,250 | 2,420 | — | 9,450 | 7,380 |
| **Alstin DW** | 6,320 | 5,940 | 7,810 | 9,450 | — | 4,270 |
| **Cartadania Pt** | 4,580 | 1,680 | 6,940 | 7,380 | 4,270 | — |

### 9.3 Detailed Route Calculations

#### Route 1: Urceopolis → Daxia Harbor (Trans-Levantine Route)

```
Leg 1: Urceopolis (28°E, 45°N) → Kilikas Sea exit (35°E, 55°N)
  Δφ = 10°, Δλ = 7°
  d = 111.32 × √(10² + (7·cos(50°))²) = 111.32 × √(100 + 20.25) = 111.32 × 10.97 = 1,221 km = 659 nm

Leg 2: Kilikas exit (35°E, 55°N) → Sea of Nordska (98°E, 52°N)
  Δφ = 3°, Δλ = 63°
  d = R × c where:
    a = sin²(1.5°) + cos(55°)·cos(52°)·sin²(31.5°)
    a = 0.000685 + 0.5736·0.6157·0.2731 = 0.000685 + 0.09648 = 0.09716
    c = 2·atan2(0.3117, 0.9502) = 0.6355 rad
    d = 6371 × 0.6355 = 4,049 km = 2,186 nm

Leg 3: Sea of Nordska (98°E, 52°N) → Daxia Harbor (95°E, 18°N)
  Δφ = 34°, Δλ = 3°
  d = 111.32 × √(34² + (3·cos(35°))²) = 111.32 × √(1156 + 6.04) = 111.32 × 34.09 = 3,794 km = 2,049 nm

Total routed distance: 659 + 2,186 + 2,049 = 4,894 nm
Great-circle direct: 4,680 nm
Route efficiency: 95.6%
```

#### Route 2: Urceopolis → Alstin Deepwater (Trans-Odoneru Route)

```
Leg 1: Urceopolis (28°E, 45°N) → Western Levantia coast (5°E, 48°N)
  d ≈ 1,180 nm

Leg 2: Western Levantia (5°E, 48°N) → Mid-Odoneru waypoint (-40°E, 35°N)
  Δφ = 13°, Δλ = 45°
  a = sin²(6.5°) + cos(48°)·cos(35°)·sin²(22.5°)
  a = 0.01284 + 0.6691·0.8192·0.1464 = 0.01284 + 0.08024 = 0.09308
  c = 0.6218 rad → d = 3,961 km = 2,139 nm

Leg 3: Mid-Odoneru (-40°E, 35°N) → Alstin Deepwater (-80°E, 20°N)
  Δφ = 15°, Δλ = 40°
  a = sin²(7.5°) + cos(35°)·cos(20°)·sin²(20°)
  a = 0.01704 + 0.8192·0.9397·0.1170 = 0.01704 + 0.09011 = 0.10715
  c = 0.6694 rad → d = 4,264 km = 2,302 nm

Total routed distance: 1,180 + 2,139 + 2,302 = 5,621 nm
(With current assistance from Levantine Coast Current: effective ~5,300 nm equivalent)
```

#### Route 3: Caphiria City → Cartadania Port (Kindreds Sea Route)

```
Leg 1: Caphiria City (15°E, 25°S) → Kindreds Sea (-8°W, 28°S)
  Δφ = 3°, Δλ = 23°
  d at lat 26.5°S: cos(26.5°) = 0.8949
  d ≈ 111.32 × √(9 + (23·0.8949)²) = 111.32 × √(9 + 423.8) = 111.32 × 20.81 = 2,316 km = 1,250 nm

Leg 2: Kindreds Sea (-8°W, 28°S) → Cartadania Port (-5°E, 22°S)
  d ≈ 430 nm

Total: ~1,680 nm
Very efficient route through protected Kindreds Sea waters.
```

### 9.4 Complete Port-to-Port Distance Table (nm)

| Route | Distance (nm) | Via |
|-------|-------------|-----|
| Urceopolis → Fiannria | 380 | Kilikas Sea coastal |
| Urceopolis → Burgundie | 560 | Great Levantia coast |
| Urceopolis → Kiravia Prime | 2,850 | Kilikas Sea → Nordska |
| Urceopolis → Daxia Harbor | 4,680 | Nordska → Dolong coast |
| Urceopolis → Caphiria City | 4,120 | Levantia south → Sarpedon |
| Urceopolis → Alstin DW | 6,320 | Trans-Odoneru |
| Fiannria → Faneria | 210 | Gallia Magna coast |
| Fiannria → Kiravia Prime | 2,600 | Kilikas → Nordska |
| Burgundie → Caphiria City | 3,780 | South through Odoneru |
| Kiravia Prime → Daxia Harbor | 2,420 | Nordska → Dolong |
| Kiravia Prime → Timbia | 5,240 | Nordska → Founders Sea |
| Daxia Harbor → Oyashima | 520 | Dolong coastal |
| Daxia Harbor → Metzetta | 780 | Dolong coastal |
| Daxia Harbor → Argyrea | 1,850 | Dolong → Daria coast |
| Daxia → Timbia | 3,890 | Sea of Istroya → Founders |
| Alstin DW → Paulastra | 1,680 | South Crona coast |
| Alstin DW → Canespa | 1,420 | Cusinaut coast |
| Alstin DW → Varshan | 2,180 | SW via St. John Sea |
| Cartadania → Pelaxia | 890 | Kindreds coast |
| Cartadania → Caphiria City | 1,680 | Kindreds Sea |
| Cartadania → Castadilla | 1,240 | Vallos coast |
| Caphiria → Kostava | 2,150 | Sarposlavia coast |
| Timbia → Daxia | 3,890 | Founders → Istroya → Dolong |
| Paulastra → Tierrador | 1,450 | South Crona coast |
| Tierrador → Cartadania | 3,620 | Around Crona south → Polynesian |

---

## 10. Optimal Route Analysis

### 10.1 Current-Assisted Routes

Ships can significantly reduce fuel consumption and transit time by riding favorable currents. The following routes benefit from current assistance:

#### 10.1.1 Dolong Express (Daxia → Kiravia Prime via Dolong Warm Current)

```
Route: Daxia (95°E, 18°N) → ride Dolong Warm Current NE →
       Sea of Nordska (98°E, 52°N) → Kiravia Prime (80°E, 60°N)

Current assistance: +1.5–2.5 knots (Dolong Warm Current, 18°N–45°N)
Ship speed: 14 knots + 2 knots current = 16 knots effective
Distance: 2,420 nm
Time: 2,420 / 16 = 151.3 hours = 6.3 days

Without current: 2,420 / 14 = 172.9 hours = 7.2 days
Savings: 0.9 days (12.5%)
```

#### 10.1.2 Levantine Corridor (Fiannria → Daxia via Westerlies Belt)

```
Route: Fiannria (18°E, 50°N) → ride Westerlies eastward across Kilikas Sea →
       Sea of Nordska → Dolong coast → Daxia

Wind assistance: Prevailing westerlies (15–25 knots SW→NE)
  reduce fuel consumption by ~18% on eastbound leg
Current: Weak eastward flow in subpolar gyre

Eastbound optimal transit: 4,450 nm at 15.5 knots effective = 12.0 days
Westbound (against winds): 4,450 nm at 12.5 knots effective = 14.8 days
Difference: 2.8 days
```

#### 10.1.3 Southern Circumpolar Express (Timbia → Cartadania)

```
Route: Timbia (105°E, 38°S) → ride South Cathayan Circumpolar Current eastward →
       through Absurian approaches → round Sarpedon south →
       Cartadania (-5°E, 22°S)

Circumpolar current: +1.0–1.5 knots (eastward)
Roaring Forties winds: Strong tailwinds for eastbound vessels

Eastbound (with current): 8,200 nm at 15 knots effective = 22.8 days
Westbound (against current): 8,200 nm at 11 knots effective = 31.1 days

⚠️ WARNING: Route passes through Absurian Ocean (55°S–60°S latitudes)
Seasonal restriction: IxNovember–IxMarch only (ice-free window)
Storm risk: High — wave heights routinely exceed 6m in Roaring Forties
```

### 10.2 Trade Wind Express Routes

#### 10.2.1 Equatorial Trade Route (Audonia → Crona via NE Trades)

```
Route: Argyrea (72°E, 12°N) → ride NE Trade Winds westward across →
       Odoneru Ocean → Sea of St. John → Crona west coast →
       Canespa (-55°E, 12°N)

NE Trade Wind belt: 10°N–30°N, blowing NE→SW
  Ships sailing westward benefit from following seas
  Current: Westward equatorial current (+0.8 knots)

Westbound: 6,850 nm at 14.8 knots effective = 19.3 days
Eastbound (against trades): 6,850 nm at 11.2 knots effective = 25.5 days
Savings westbound: 6.2 days (24.3%)
```

### 10.3 Route Optimization Summary

| Route | Direction | Distance (nm) | Current Boost | Wind Factor | Optimal Speed | Transit Days |
|-------|-----------|---------------|--------------|-------------|--------------|-------------|
| Daxia → Kiravia | NE | 2,420 | +2.0 kn | Westerlies assist | 16.0 kn | 6.3 |
| Kiravia → Daxia | SW | 2,420 | -1.5 kn | Head winds | 12.5 kn | 8.1 |
| Fiannria → Daxia | E | 4,450 | +0.5 kn | Westerlies assist | 15.5 kn | 12.0 |
| Daxia → Fiannria | W | 4,450 | -0.5 kn | Head winds | 12.5 kn | 14.8 |
| Urceopolis → Alstin | W | 6,320 | +0.8 kn | Trade assist (low lat) | 14.8 kn | 17.8 |
| Alstin → Urceopolis | E | 6,320 | -0.8 kn | Against trades | 12.2 kn | 21.6 |
| Caphiria → Cartadania | W | 1,680 | +0.4 kn | Mild | 14.4 kn | 4.9 |
| Argyrea → Canespa | W | 6,850 | +0.8 kn | NE Trades | 14.8 kn | 19.3 |
| Timbia → Cartadania | E (southern) | 8,200 | +1.2 kn | Roaring 40s | 15.0 kn | 22.8 |

---

## 11. Shipping Time Calculations

### 11.1 Vessel Speed Classifications

| Vessel Type | Service Speed (knots) | Cargo Capacity (TEU) | Fuel Consumption (tons/day) |
|-------------|----------------------|----------------------|-----------------------------|
| Ultra-Large Container (ULCV) | 14–16 | 18,000–24,000 | 250–350 |
| Post-Panamax Container | 14–15 | 10,000–14,000 | 180–250 |
| Panamax Container | 13–14 | 4,000–6,000 | 120–170 |
| Bulk Carrier (Capesize) | 12–14 | — (180,000 DWT) | 45–65 |
| Tanker (VLCC) | 12–13 | — (300,000 DWT) | 80–120 |
| General Cargo | 12–14 | 500–2,000 | 25–40 |
| Ro-Ro / Ferry | 16–22 | 200–800 vehicles | 60–120 |
| Naval Frigate | 28–30 | — | 35–50 |

### 11.2 Transit Time Formula

```
T = D / (V_ship + V_current ± V_wind_effect)

Where:
  T = transit time (hours)
  D = route distance (nautical miles)
  V_ship = vessel service speed (knots)
  V_current = current speed along route (knots, ± based on direction)
  V_wind_effect = effective speed change from wind (knots)
    For following seas: +0.5 to +2.0 knots
    For head seas: -0.5 to -3.0 knots (depending on sea state)
    For beam seas: -0.5 to -1.0 knots (added resistance)
```

### 11.3 Transit Time Tables

#### Container Ship (14 knots base) — Major Routes

| Route | Distance (nm) | Current (kn) | Wind (kn) | Eff. Speed | Time (days) |
|-------|-------------|-------------|-----------|-----------|------------|
| Urceopolis → Fiannria | 380 | +0.3 | +0.5 | 14.8 | 1.1 |
| Urceopolis → Burgundie | 560 | +0.2 | +0.3 | 14.5 | 1.6 |
| Urceopolis → Caphiria City | 4,120 | -0.2 | ±0 | 13.8 | 12.5 |
| Urceopolis → Kiravia Prime | 2,850 | +0.4 | +0.8 | 15.2 | 7.8 |
| Urceopolis → Daxia Harbor | 4,680 | +0.5 | +0.6 | 15.1 | 12.9 |
| Urceopolis → Alstin DW | 6,320 | +0.5 | +0.3 | 14.8 | 17.8 |
| Fiannria → Daxia Harbor | 4,450 | +0.5 | +1.0 | 15.5 | 12.0 |
| Kiravia → Daxia Harbor | 2,420 | +0.3 | +0.5 | 14.8 | 6.8 |
| Caphiria → Cartadania | 1,680 | +0.4 | +0.2 | 14.6 | 4.8 |
| Alstin → Paulastra | 1,680 | +0.3 | +0.3 | 14.6 | 4.8 |
| Daxia → Oyashima | 520 | +0.5 | +0.3 | 14.8 | 1.5 |
| Daxia → Timbia | 3,890 | +0.2 | ±0 | 14.2 | 11.4 |

#### Bulk Carrier (12 knots base) — Commodity Routes

| Route | Distance (nm) | Eff. Speed | Time (days) | Primary Cargo |
|-------|-------------|-----------|------------|--------------|
| Daxia → Urceopolis | 4,680 | 12.8 | 15.2 | Manufactured goods, electronics |
| Argyrea → Fiannria | 5,200 | 12.3 | 17.6 | Raw materials, minerals |
| Tierrador → Caphiria | 5,400 | 12.5 | 18.0 | Agricultural products, metals |
| Alstin → Burgundie | 5,800 | 12.0 | 20.1 | Petroleum, LNG |
| Varshan → Daxia | 8,200 | 11.8 | 29.0 | Bulk commodities |
| Timbia → Kiravia | 5,240 | 12.5 | 17.5 | Minerals, food |

### 11.4 Express vs. Economy Routing

For the critical **Urceopolis ↔ Daxia** corridor (the busiest trade lane):

```
Express Service (Post-Panamax, 15 knots, with current):
  4,680 nm / (15 + 1.5) = 283.6 hours = 11.8 days

Economy Service (Panamax, 13 knots, slow steaming):
  4,680 nm / (13 + 0.5) = 346.7 hours = 14.4 days

Slow Steaming (Eco, 10 knots):
  4,680 nm / (10 + 0.5) = 445.7 hours = 18.6 days
  Fuel savings: ~45% vs. express
```

---

## 12. Strait & Chokepoint Analysis

### 12.1 Critical Maritime Chokepoints

| # | Chokepoint | Location | Width (km) | Depth (m) | Daily Transits (est.) | Strategic Controller |
|---|-----------|----------|-----------|----------|----------------------|---------------------|
| 1 | Barbary Straits | 115°E, 2°N | 85 | 45–120 | 340 | Daxia / Oyashima |
| 2 | Kilikas Narrows | 22°E, 56°N | 120 | 80–200 | 280 | Urcea / Fiannria |
| 3 | Kindreds Passage | -10°E, -26°S | 200 | 150–400 | 190 | Cartadania / Pelaxia |
| 4 | Tainean Gate | -12°E, -10°S | 160 | 100–300 | 150 | Sarpedon (Vallos) |
| 5 | Nordska Entrance | 90°E, 48°N | 280 | 120–500 | 120 | Kiravia / Daxia |

### 12.2 Barbary Straits — Critical Analysis

The Barbary Straits at 115°E, 2°N are the most strategically significant chokepoint on IxEarth. An estimated 35% of all Levantine Ocean commercial traffic passes through this 85 km-wide channel.

```
Traffic Volume:
  340 vessels/day × 365 = 124,100 transits/year
  Average cargo value: ~$45M per transit
  Annual throughput: ~$5.6 trillion

Current conditions:
  Prevailing current: Westward at 1.2 knots
  Tidal range: 1.8m (semi-diurnal)
  Maximum vessel draft: 18m (natural depth limits)
  Traffic Separation Scheme: 2 lanes, 4 km separation

Chokepoint vulnerability:
  Single-point blockage would redirect traffic via:
  - Southern route (+2,400 nm, +6.8 days)
  - Northern route via Nordska (+3,100 nm, +8.9 days)
```

### 12.3 Kilikas Narrows

The entrance to the Kilikas Sea funnels all maritime commerce between western Levantia and the northern/eastern trade routes.

```
Width at narrowest: 120 km
Depth: 80–200 m
Tidal current: up to 3.0 knots (semi-diurnal)
  Spring tide: 4.5m range
  Neap tide: 1.8m range

Passage timing: Ships must transit with favorable tide
  Optimal window: 3 hours either side of slack water
  Against-tide transit adds ~2 hours
```

---

## 13. Tidal Systems & Sea Level

### 13.1 Tidal Model

IxEarth tides follow standard lunisolar forcing:

```
η(t) = H₀ · cos(ωt - φ)

Where:
  η = tidal elevation
  H₀ = tidal amplitude
  ω = angular frequency
  φ = phase

Dominant constituents:
  M₂ (principal lunar): T = 12.42 hours, typical amplitude 0.3–1.5 m
  S₂ (principal solar): T = 12.00 hours, typical amplitude 0.1–0.5 m
  K₁ (lunisolar diurnal): T = 23.93 hours, typical amplitude 0.1–0.4 m
```

### 13.2 Tidal Ranges by Location

| Location | Type | Spring Range (m) | Neap Range (m) | Notes |
|----------|------|------------------|----------------|-------|
| Open Levantine Ocean | Semi-diurnal | 0.8 | 0.3 | Minimal |
| Barbary Straits | Semi-diurnal | 1.8 | 0.7 | Current amplified |
| Kilikas Narrows | Semi-diurnal | 4.5 | 1.8 | Funnel effect |
| Sea of Canete (coast) | Mixed | 2.2 | 0.9 | Monsoon modulated |
| Kindreds Sea (inner) | Semi-diurnal | 1.4 | 0.5 | Protected basin |
| Sea of Nordska | Semi-diurnal | 1.6 | 0.6 | Ice-dampened in winter |
| Okatian Sea | Semi-diurnal | 3.2 | 1.3 | Southern exposure amplifies |
| Albion Sea | Semi-diurnal | 3.8 | 1.5 | Resonant basin |

---

## 14. Marine Ecology Zones

### 14.1 Biogeographic Provinces

| Zone | Latitude Range | SST (°C) | Defining Features | Key Fisheries |
|------|---------------|----------|-------------------|--------------|
| Tropical Pelagic | 0°–15° | 26–30 | Coral reefs, high biodiversity | Tuna, mahi-mahi, reef fish |
| Subtropical Convergence | 15°–30° | 20–27 | Sargasso-type gyres, oligotrophic | Swordfish, marlin |
| Temperate Upwelling | 30°–45° (eastern boundaries) | 12–20 | Nutrient-rich upwelling | Sardine, anchovy, hake |
| Temperate Shelf | 35°–55° | 8–18 | Continental shelves, high productivity | Cod, herring, flatfish |
| Subpolar | 50°–65° | 2–10 | Deep mixing, spring blooms | Pollock, crab, krill |
| Polar/Ice Edge | 65°+ | -2–2 | Seasonal ice, extreme productivity pulses | Krill, ice fish |

### 14.2 Major Fishing Grounds

1. **Dolong Banks** (Sea of Nordska, 95°E–105°E, 45°N–55°N): Cold-water upwelling zone supporting the world's largest cod and pollock fisheries. Annual catch: ~4.2M tons.

2. **Darian Shelf** (Sea of Canete, 50°E–65°E, 5°S–15°N): Tropical pelagic zone. Tuna purse-seine and longline fleets from Audonian nations. Annual catch: ~3.8M tons.

3. **Kindreds Upwelling** (Kindreds Sea, 15°W–5°E, 25°S–35°S): Eastern boundary upwelling driven by SE Trade Winds. Rich sardine and anchovy stocks. Annual catch: ~2.9M tons.

4. **Cronan Grand Banks** (Sea of St. John, 145°W–130°W, 10°N–25°N): Shallow continental shelf with warm-temperate species. Annual catch: ~2.1M tons.

5. **Albion Grounds** (Albion Sea, 65°W–50°W, 50°N–60°N): Cold-water fishery connecting Levantine and Cronan stocks. Annual catch: ~1.4M tons.

---

## 15. Appendices

### Appendix A: Shipping Route Map Reference Points

All waypoints use (longitude, latitude) format:

```
TRADE ROUTE: LEVANTINE CORRIDOR (East-West)
  WP01: Urceopolis          (28, 45)
  WP02: Kilikas entrance     (22, 56)
  WP03: Kilikas exit         (35, 55)
  WP04: Nordska western      (70, 50)
  WP05: Nordska central      (98, 52)
  WP06: Dolong approach      (95, 35)
  WP07: Daxia Harbor          (95, 18)
  WP08: Barbary Straits      (115, 2)
  WP09: Oyashima Harbor      (110, 25)

TRADE ROUTE: TRANS-ODONERU (Levantia → Crona)
  WP10: Burgundie Port        (35, 42)
  WP11: Levantine coast exit  (5, 48)
  WP12: Mid-Odoneru          (-40, 35)
  WP13: Cronan approach      (-65, 25)
  WP14: Alstin Deepwater     (-80, 20)
  WP15: Canespa Harbor       (-55, 12)

TRADE ROUTE: KINDREDS ARC (Sarpedon intra)
  WP16: Caphiria City         (15, -25)
  WP17: Tainean Gate          (-12, -10)
  WP18: Kindreds entrance    (-5, -25)
  WP19: Cartadania Port      (-5, -22)
  WP20: Pelaxia Terminal     (-15, -30)
  WP21: Castadilla Port      (-25, -20)

TRADE ROUTE: SOUTHERN CRONA
  WP22: Paulastra Harbor     (-70, -8)
  WP23: Tierrador Port       (-90, -30)
  WP24: Polynesian crossing  (-55, -30)

TRADE ROUTE: AUSTRALIS CONNECTOR
  WP25: Timbia Port          (105, -38)
  WP26: Founders Sea         (80, -40)
  WP27: Pukhtun approach     (145, -25)

TRADE ROUTE: KIROBORE NORTHERN
  WP28: Kiravia Prime         (80, 60)
  WP29: Olmeria Port          (90, 55)
```

### Appendix B: Beaufort Scale Frequency by Region (Annual %)

| Region | Force 0–3 | Force 4–6 | Force 7–9 | Force 10+ |
|--------|----------|----------|----------|----------|
| Tropical Levantine | 35 | 50 | 13 | 2 |
| Kilikas Sea | 20 | 45 | 28 | 7 |
| Sea of Nordska | 15 | 40 | 32 | 13 |
| Sea of Canete (summer) | 25 | 55 | 17 | 3 |
| Sea of Canete (winter) | 40 | 45 | 12 | 3 |
| Kindreds Sea | 30 | 48 | 18 | 4 |
| Odoneru (tropics) | 30 | 50 | 16 | 4 |
| Odoneru (westerlies) | 15 | 40 | 33 | 12 |
| Roaring Forties (40°S–50°S) | 5 | 25 | 45 | 25 |
| Absurian Ocean | 8 | 22 | 40 | 30 |
| Great Expanse (doldrums) | 55 | 35 | 8 | 2 |

### Appendix C: Seasonal Navigation Hazards

| Month (IxTime) | Region | Hazard | Risk Level |
|---------------|--------|--------|-----------|
| IxJan–IxMar | Sea of Nordska | Winter storms, sea ice | HIGH |
| IxJan–IxMar | Kilikas Sea | Gale-force westerlies | MODERATE |
| IxMay–IxSep | Sea of Canete | Monsoon squalls | MODERATE |
| IxJun–IxNov | Tropical Levantine | Tropical cyclone season | HIGH |
| IxJun–IxNov | Great Expanse | Typhoon risk | HIGH |
| IxMay–IxOct | Absurian Ocean | Pack ice, icebergs | EXTREME |
| Year-round | Roaring Forties | Heavy swells, storms | HIGH |
| IxOct–IxDec | Albion Sea | North Atlantic storms | MODERATE |
| IxApr/IxOct | Sea of Canete | Monsoon transition squalls | MODERATE |

### Appendix D: Economic Significance of Ocean Trade

Top 10 bilateral maritime trade corridors by estimated annual value:

| # | Corridor | Annual Value ($B) | Primary Goods |
|---|---------|------------------|--------------|
| 1 | Urcea ↔ Daxia | 890 | Electronics, machinery, chemicals |
| 2 | Urcea ↔ Caphiria | 780 | Manufactured goods, agricultural |
| 3 | Kiravia ↔ Daxia | 650 | Energy, raw materials, tech |
| 4 | Burgundie ↔ Cartadania | 540 | Financial services goods, luxury |
| 5 | Fiannria ↔ Kiravia | 510 | Industrial equipment, food |
| 6 | Alstin ↔ Urcea | 480 | Consumer goods, vehicles |
| 7 | Caphiria ↔ Cartadania | 430 | Intra-Sarpedon trade, energy |
| 8 | Faneria ↔ Daxia | 390 | Textiles, electronics |
| 9 | Tierrador ↔ Caphiria | 360 | Agricultural, minerals |
| 10 | Daxia ↔ Argyrea | 340 | Regional Audonian trade |

**Total estimated global maritime trade**: ~$18.4 trillion annually
**Ocean-dependent GDP share**: ~62% of global economic output
**Maritime employment**: ~12 million direct jobs across all nations

### Appendix E: Units & Conversions

| Quantity | Unit | Conversion |
|----------|------|-----------|
| Distance | Nautical mile (nm) | 1 nm = 1.852 km = 1.151 mi |
| Speed | Knot (kn) | 1 kn = 1.852 km/h = 1 nm/h |
| Volume transport | Sverdrup (Sv) | 1 Sv = 10⁶ m³/s |
| Depth | Meters (m) | 1 fathom = 1.829 m |
| Pressure | Hectopascal (hPa) | 1 atm = 1013.25 hPa |
| Wave height | Meters (m) | Significant wave height = avg of top ⅓ |
| Temperature | Celsius (°C) | °F = °C × 9/5 + 32 |

---

*This report was compiled using IxWorld climate simulation data (Trewartha classification), geographic survey coordinates, and economic modeling from IxStates 1.0 Ogma. All distances computed via Haversine formula. Shipping times assume standard commercial vessel operations with weather routing. Current speeds derived from the IxWorld ocean circulation model with western boundary intensification.*

*© IxWorld Bureau of Oceanographic Sciences, IxYear 2041*
