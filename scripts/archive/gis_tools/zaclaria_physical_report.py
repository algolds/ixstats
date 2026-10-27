"""Zaclaria physical-geography analysis, read directly from the IxEarth GeoJSON dumps.

Usage: python3 scripts/archive/gis_tools/zaclaria_physical_report.py OUT.json
Notes: altitude/climate layers are resolved in painter's order (later features on top);
antimeridian-wrapped parts are dropped; rivers are double-bank outline rings (length / 2).
See scripts/reports/zaclaria-physical-geography.md.
"""
import json, math, collections, sys, os
from shapely.geometry import shape, Point, LineString, MultiLineString, mapping, box
from shapely.ops import unary_union, linemerge
from pyproj import Geod

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "geojson_dumps", "geojson_sanitized") + "/"
G = Geod(ellps="WGS84")
NAME = "Zaclaria"

ALT = {"#a8c995": "Coastal Lowlands (0–99 m)", "#c3d3a1": "Low Hills (100–349 m)",
       "#dcdcac": "Rolling Hills (350–499 m)", "#f7e6b8": "Uplands (500–999 m)",
       "#dac497": "Low Mountains (1,000–1,999 m)", "#bea276": "Mid Mountains (2,000–2,999 m)",
       "#9c7b50": "High Mountains (3,000–3,999 m)", "#796142": "Alpine (4,000–4,999 m)",
       "#4f4236": "Extreme Alpine (5,000 m+)"}
ALT_ORDER = list(ALT)
CLIM = {"#00fd97": "Temperate Oceanic (Do)", "#326500": "Subtropical Humid (Cf)",
        "#fd9833": "Steppe / Semiarid (BS)", "#659700": "Subtropical Dry Summer (Cs)",
        "#fc3502": "Tropical Wet-and-Dry (Aw)", "#980000": "Tropical Wet (Ar)",
        "#fcfc33": "Desert / Arid (BW)", "#0098fd": "Temperate Continental (Dc)",
        "#9ea7b0": "Tundra (Ft)", "#0065ca": "Boreal (E)", "#fecbfe": "Highland (H)"}

def load(n): return json.load(open(SRC + n + ".geojson"))["features"]
def safe_shape(geom):
    try: return shape(geom)
    except Exception:
        if geom["type"] == "MultiLineString":
            return MultiLineString([c for c in geom["coordinates"] if len(c) > 1])
        raise
def garea(g):
    if g.is_empty: return 0.0
    return abs(G.geometry_area_perimeter(g)[0]) / 1e6
def glen(g):
    if g.is_empty: return 0.0
    return G.geometry_length(g) / 1e3
def polys(g):
    if g.is_empty: return []
    if g.geom_type == "Polygon": return [g]
    if hasattr(g, "geoms"): return [p for x in g.geoms for p in polys(x)]
    return []
def lines(g):
    if g.is_empty: return []
    if g.geom_type == "LineString": return [g]
    if hasattr(g, "geoms"): return [l for x in g.geoms for l in lines(x)]
    return []
def bearing_name(az):
    dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
    return dirs[int(((az % 360) + 11.25) // 22.5) % 16]
def r(x, n=1): return round(x, n)
def ll(p): return {"lat": r(p.y, 3), "lng": r(p.x, 3)}

out = {}
pol = load("political")
feat = next(f for f in pol if f["properties"]["id"] == NAME)
C = shape(feat["geometry"]).buffer(0)
out["source"] = {"file": "scripts/archive/geojson_dumps/geojson_sanitized/*.geojson",
                 "feature_properties": feat["properties"]}
A = garea(C)
ext = C.exterior
minx, miny, maxx, maxy = C.bounds
coords = list(ext.coords)
def extreme(key):
    p = max(coords, key=key); return {"lng": r(p[0], 3), "lat": r(p[1], 3)}
cen = C.centroid; rep = C.representative_point()
ns = G.inv((minx+maxx)/2, miny, (minx+maxx)/2, maxy)[2]/1e3
ew_mid = G.inv(minx, (miny+maxy)/2, maxx, (miny+maxy)/2)[2]/1e3
per = glen(ext) + sum(glen(i) for i in C.interiors)
# farthest point from boundary (pole of inaccessibility, approx)
from shapely import ops
try:
    from shapely import polylabel
    poi = polylabel(C, tolerance=0.01)
except Exception:
    poi = rep
poi_dist = min(G.inv(poi.x, poi.y, x, y)[2] for x, y in coords)/1e3
# max internal span
hull = list(C.convex_hull.exterior.coords)
best = (0, None, None)
for i in range(len(hull)):
    for j in range(i+1, len(hull)):
        d = G.inv(hull[i][0], hull[i][1], hull[j][0], hull[j][1])[2]
        if d > best[0]: best = (d, hull[i], hull[j])
out["geometry"] = {
    "type": feat["geometry"]["type"], "vertices": len(coords), "holes": len(C.interiors),
    "area_km2": r(A, 0), "area_sqmi": r(A/2.589988, 0), "perimeter_km": r(per, 0),
    "bbox": {"minLng": r(minx,4), "minLat": r(miny,4), "maxLng": r(maxx,4), "maxLat": r(maxy,4)},
    "ns_extent_km": r(ns,0), "ew_extent_mid_km": r(ew_mid,0),
    "max_span_km": r(best[0]/1e3,0), "max_span_from": {"lng": r(best[1][0],3), "lat": r(best[1][1],3)},
    "max_span_to": {"lng": r(best[2][0],3), "lat": r(best[2][1],3)},
    "extremes": {"north": extreme(lambda p: p[1]), "south": extreme(lambda p: -p[1]),
                 "east": extreme(lambda p: p[0]), "west": extreme(lambda p: -p[0])},
    "centroid": ll(cen), "pole_of_inaccessibility": ll(poi), "poi_distance_to_border_km": r(poi_dist,0),
    "polsby_popper": r(4*math.pi*A/(per**2), 3),
    "convex_hull_ratio": r(A/garea(C.convex_hull), 3),
}

# Neighbours / borders
def unwrap(g):
    # drop antimeridian-wrapped parts (bbox wider than 180°), which paint false bands across the map
    ps = [p for p in polys(g) if (p.bounds[2] - p.bounds[0]) < 180]
    return unary_union(ps) if ps else None
others, wrapped = [], []
for f in pol:
    if f["properties"]["id"] == NAME: continue
    g0 = shape(f["geometry"]).buffer(0); g = unwrap(g0)
    if g is not None and len(polys(g)) != len(polys(g0)) and g0.intersects(C): wrapped.append(f["properties"]["id"])
    if g is not None: others.append((f["properties"]["id"], g))
out["excluded_wrapped_features"] = wrapped
tol = 0.02  # ~2 km snapping tolerance for border matching
Cb = C.boundary
nbr = []
shared_all = []
for nid, g in others:
    if not g.intersects(C.buffer(0.1)): continue
    seg = Cb.intersection(g.buffer(tol))
    L = glen(seg)
    mp = seg.centroid if not seg.is_empty else ops.nearest_points(C, g)[1]
    az = G.inv(cen.x, cen.y, mp.x, mp.y)[0]
    bb = seg.bounds if not seg.is_empty else None
    dist = C.distance(g)
    nbr.append({"name": nid, "shared_border_km": r(L,0), "direction": bearing_name(az),
                "border_midpoint": ll(mp), "border_bbox": [r(x,2) for x in bb] if bb else None,
                "touches": dist < 1e-6})
    if L > 0: shared_all.append(seg)
nbr.sort(key=lambda x: -x["shared_border_km"])
land_border = unary_union(shared_all) if shared_all else None
land_km = glen(land_border) if land_border else 0
coast = Cb.difference(unary_union([g for _, g in others if g.intersects(C.buffer(0.1))]).buffer(tol))
coast_km = glen(coast)
out["borders"] = {"neighbours": nbr, "land_border_km": r(land_km,0), "coastline_km": r(coast_km,0),
                  "coast_share_pct": r(100*coast_km/(coast_km+land_km),1),
                  "coast_to_area_m_per_km2": r(coast_km*1000/A,2)}
# coastline by facing sector (outward normal of segments)
sect = collections.Counter()
for l in lines(coast):
    cs = list(l.coords)
    for a, b in zip(cs, cs[1:]):
        az, _, d = G.inv(a[0], a[1], b[0], b[1])
        mid = Point((a[0]+b[0])/2, (a[1]+b[1])/2)
        # outward normal: test point to the right/left
        for off in (90, -90):
            lon, lat, _ = G.fwd(mid.x, mid.y, az+off, 3000)
            if not C.contains(Point(lon, lat)):
                sect[bearing_name(az+off)[:1] if False else ["N","NE","E","SE","S","SW","W","NW"][int(((az+off)%360+22.5)//45)%8]] += d/1e3
                break
out["borders"]["coastline_by_facing"] = {k: r(v,0) for k, v in sorted(sect.items(), key=lambda x: -x[1])}

# Nearby countries within 300 km (not touching)
near = []
for nid, g in others:
    d = C.distance(g)
    if d < 4:
        p1, p2 = ops.nearest_points(C, g)
        km = G.inv(p1.x, p1.y, p2.x, p2.y)[2]/1e3
        if km < 400:
            near.append({"name": nid, "min_distance_km": r(km,0),
                         "direction": bearing_name(G.inv(cen.x, cen.y, p2.x, p2.y)[0])})
near.sort(key=lambda x: x["min_distance_km"])
out["borders"]["within_400km"] = near

# Painter's-order coverage
def painted(layer, legend):
    feats = load(layer)
    shapes = []
    for i, f in enumerate(feats):
        g0 = safe_shape(f["geometry"]).buffer(0); g = unwrap(g0)
        if g is None: continue
        if len(polys(g)) != len(polys(g0)) and g0.intersects(C): out.setdefault("excluded_wrapped_parts", {}).setdefault(layer, []).append(f["properties"]["id"])
        shapes.append((i, f, g))
    idx = [k for k, (i, f, g) in enumerate(shapes) if g.intersects(C)]
    res = []
    for k in idx:
        i, f, g = shapes[k]
        vis = g.intersection(C)
        above = [shapes[m][2] for m in range(k+1, len(shapes)) if shapes[m][2].intersects(vis)]
        if above: vis = vis.difference(unary_union(above))
        res.append((f, vis))
    return res

def summarize(res, legend, order=None):
    by = collections.defaultdict(list)
    for f, v in res:
        by[f["properties"]["fill"]].extend(polys(v))
    covered = unary_union([v for _, v in res])
    tot = []
    for fill, ps in by.items():
        a = sum(garea(p) for p in ps)
        if a < 0.5: continue
        ps2 = [p for p in ps if garea(p) >= 1]
        big = max(ps2, key=garea) if ps2 else None
        lats = [p.centroid.y for p in ps2]; lngs = [p.centroid.x for p in ps2]
        u = unary_union(ps)
        tot.append({"fill": fill, "class": legend.get(fill, "UNMAPPED " + fill), "area_km2": r(a,0),
                    "pct": r(100*a/A,2), "patches": len(ps2),
                    "largest_patch_km2": r(garea(big),0) if big else 0,
                    "largest_patch_centre": ll(big.representative_point()) if big else None,
                    "lat_range": [r(u.bounds[1],2), r(u.bounds[3],2)],
                    "lng_range": [r(u.bounds[0],2), r(u.bounds[2],2)],
                    "area_weighted_centre": ll(u.centroid),
                    "patch_list": [{"area_km2": r(garea(p),0), "centre": ll(p.representative_point()),
                                    "bbox": [r(x,2) for x in p.bounds],
                                    "touches_coast": p.buffer(0.02).intersects(coast)}
                                   for p in sorted(ps2, key=garea, reverse=True)],
                    "subgroups": sorted({str(f["properties"]["ixmap-subgroup"]) for f, v in res if f["properties"]["fill"] == fill}),
                    "source_ids": sorted({f["properties"]["id"] for f, v in res if f["properties"]["fill"] == fill and not v.is_empty})})
    if order: tot.sort(key=lambda x: order.index(x["fill"]) if x["fill"] in order else 99)
    else: tot.sort(key=lambda x: -x["area_km2"])
    uncovered = garea(C.difference(covered))
    return tot, uncovered, by

alt_res = painted("altitudes", ALT)
alt, alt_unc, alt_by = summarize(alt_res, ALT, ALT_ORDER)
out["elevation"] = {"zones": alt, "uncovered_km2": r(alt_unc,1)}
clim_res = painted("climate", CLIM)
clim, clim_unc, clim_by = summarize(clim_res, CLIM)
out["climate"] = {"zones": clim, "uncovered_km2": r(clim_unc,1)}

# Cross-tab climate x elevation
xt = []
alt_u = {k: unary_union(v) for k, v in alt_by.items()}
clim_u = {k: unary_union(v) for k, v in clim_by.items()}
for cf, cu in clim_u.items():
    for af, au in alt_u.items():
        a = garea(cu.intersection(au))
        if a >= 1: xt.append({"climate": CLIM.get(cf, cf), "elevation": ALT.get(af, af), "area_km2": r(a,0), "pct_of_country": r(100*a/A,2)})
out["climate_x_elevation"] = sorted(xt, key=lambda x: -x["area_km2"])

# Latitude & longitude transects (1-degree bands)
def bands(axis):
    rows = []
    lo, hi = (math.floor(miny), math.ceil(maxy)) if axis == "lat" else (math.floor(minx), math.ceil(maxx))
    for v in range(lo, hi):
        b = box(minx-1, v, maxx+1, v+1) if axis == "lat" else box(v, miny-1, v+1, maxy+1)
        cb = C.intersection(b); a = garea(cb)
        if a < 1: continue
        row = {"band": f"{v}° to {v+1}°", "land_km2": r(a,0)}
        row["elevation"] = {ALT.get(k,k).split(" (")[0]: r(100*garea(u.intersection(b))/a,1) for k, u in alt_u.items() if garea(u.intersection(b)) >= 1}
        row["climate"] = {CLIM.get(k,k): r(100*garea(u.intersection(b))/a,1) for k, u in clim_u.items() if garea(u.intersection(b)) >= 1}
        rows.append(row)
    return rows
out["latitude_bands"] = bands("lat")
out["longitude_bands"] = bands("lng")

# Coastal strip vs interior
coast_buf_deg = None
def strip(km):
    # approximate buffer in degrees at centroid latitude
    d = km/111.32
    return C.intersection(coast.buffer(d))
for km in (25, 100):
    s = strip(km); a = garea(s)
    out.setdefault("coastal_strips", {})[f"within_{km}km_of_coast"] = {
        "area_km2": r(a,0), "pct_of_country": r(100*a/A,1),
        "elevation": {ALT.get(k,k).split(" (")[0]: r(100*garea(u.intersection(s))/a,1) for k, u in alt_u.items() if garea(u.intersection(s)) >= 1},
        "climate": {CLIM.get(k,k): r(100*garea(u.intersection(s))/a,1) for k, u in clim_u.items() if garea(u.intersection(s)) >= 1}}
# farthest point from coast
far = max((Point(x, y) for x in [minx + i*(maxx-minx)/120 for i in range(121)] for y in [miny + j*(maxy-miny)/120 for j in range(121)]),
          key=lambda p: coast.distance(p) if C.contains(p) else -1)
fp = ops.nearest_points(far, coast)[1]
out["farthest_from_coast"] = {"point": ll(far), "distance_km": r(G.inv(far.x, far.y, fp.x, fp.y)[2]/1e3, 0)}

# Rivers — each river in the source is a closed outline ring (SVG stroke traced as a thin
# polygon, both banks), so channel length = ring length / 2 and source/mouth = the two hairpin tips.
rv = load("rivers")
def ring_of(geom):
    return geom["coordinates"] if geom["type"] == "LineString" else max(geom["coordinates"], key=len)
def tips_of(cs, look=6.0):
    from shapely.geometry import Polygon
    ccw = Polygon(cs).exterior.is_ccw
    cs = cs[:-1]; n = len(cs); res = []
    seg = [G.inv(*cs[i], *cs[(i+1) % n])[2]/1e3 for i in range(n)]
    for i in range(n):
        j = i; d = 0
        while d < look: j = (j-1) % n; d += seg[j]
        k = i; d = 0
        while d < look: d += seg[k]; k = (k+1) % n
        a1 = G.inv(*cs[j], *cs[i])[0]; a2 = G.inv(*cs[i], *cs[k])[0]
        turn = (a2-a1+540) % 360 - 180
        if abs(turn) > 140 and ((turn < 0) if ccw else (turn > 0)): res.append((i, abs(turn)))
    cl = []
    for i, t in res:
        if cl and i - cl[-1][-1][0] <= 3: cl[-1].append((i, t))
        else: cl.append([(i, t)])
    if len(cl) > 1 and cl[0][0][0] == 0 and cl[-1][-1][0] >= n-3: cl[0] = cl.pop() + cl[0]
    widths = []
    ringl = LineString(cs + cs[:1])
    return [Point(cs[max(c, key=lambda x: x[1])[0]]) for c in cl]
alt_all = [(f, unwrap(safe_shape(f["geometry"]).buffer(0))) for f in load("altitudes")]
alt_all = [(f, g) for f, g in alt_all if g is not None]
clim_all = [(f, unwrap(safe_shape(f["geometry"]).buffer(0))) for f in load("climate")]
clim_all = [(f, g) for f, g in clim_all if g is not None]
land = unary_union([g for f, g in alt_all if f["properties"]["ixmap-subgroup"] == "coastlines"])
def top_class(p, feats, legend):
    for f, g in reversed(feats):
        if g.contains(p): return legend.get(f["properties"]["fill"], f["properties"]["fill"])
    return "sea / none"
def country_at(p):
    if C.contains(p): return NAME
    for n, g in others:
        if g.contains(p): return n
    return "none (sea)"
landb = land.boundary
allrings = {f["properties"]["id"]: LineString(ring_of(f["geometry"])) for f in rv}
rivers = []
for f in rv:
    cs = ring_of(f["geometry"])
    ring = LineString(cs)
    if not ring.intersects(C): continue
    Lring = glen(ring); inside = ring.intersection(C)
    poly = __import__("shapely.geometry", fromlist=["Polygon"]).Polygon(cs).buffer(0)
    width = garea(poly) / (Lring/2) if Lring else 0
    tp = tips_of(cs)
    tinfo = []
    for p in tp:
        q = ops.nearest_points(p, landb)[1]
        dsea = G.inv(p.x, p.y, q.x, q.y)[2]/1e3
        tinfo.append({**ll(p), "country": country_at(p), "km_to_sea": r(dsea, 0),
                      "elevation": top_class(p, alt_all, ALT), "climate": top_class(p, clim_all, CLIM)})
    for t in tinfo:
        p = Point(t["lng"], t["lat"])
        nearr = sorted((G.inv(p.x, p.y, *ops.nearest_points(p, og)[1].coords[0])[2]/1e3, oid) for oid, og in allrings.items() if oid != f["properties"]["id"] and og.distance(p) < 0.2)
        t["joins"] = nearr[0][1] if nearr and nearr[0][0] <= 5 else None
    conf = [t for t in tinfo if t["joins"]]
    if conf:
        mouth = conf[0]; source = [t for t in tinfo if t is not mouth][0]
        mouth["role"] = f"confluence with {mouth['joins']}"
    else:
        tinfo.sort(key=lambda t: t["km_to_sea"])
        mouth, source = tinfo[0], tinfo[-1]
        mouth["role"] = "mouth (sea)" if mouth["km_to_sea"] <= 15 else "lower end (inland terminus)"
    source["role"] = "source / upper end"
    tz = {ALT.get(k,k).split(" (")[0]: r(glen(inside.intersection(u))/2,0) for k, u in alt_u.items() if glen(inside.intersection(u)) >= 2}
    tc = {CLIM.get(k,k): r(glen(inside.intersection(u))/2,0) for k, u in clim_u.items() if glen(inside.intersection(u)) >= 2}
    cross = [n for n, og in others if og.intersects(ring) and glen(ring.intersection(og)) > 2]
    rivers.append({"id": f["properties"]["id"], "fill": f["properties"]["fill"],
                   "vertices": len(cs), "outline_ring_km": r(Lring,0),
                   "channel_length_km": r(Lring/2,0), "channel_length_in_country_km": r(glen(inside)/2,0),
                   "mean_drawn_width_km": r(width,1),
                   "straight_line_source_to_mouth_km": r(G.inv(source["lng"], source["lat"], mouth["lng"], mouth["lat"])[2]/1e3,0),
                   "sinuosity": r((Lring/2)/max(1, G.inv(source["lng"], source["lat"], mouth["lng"], mouth["lat"])[2]/1e3),2),
                   "general_flow_direction": bearing_name(G.inv(source["lng"], source["lat"], mouth["lng"], mouth["lat"])[0]),
                   "also_in": cross, "source": source, "mouth": mouth,
                   "in_country_by_elevation_km": tz, "in_country_by_climate_km": tc,
                   "bbox": [r(x,2) for x in poly.bounds]})
rivers.sort(key=lambda x: -x["channel_length_in_country_km"])
tot_in = sum(x["channel_length_in_country_km"] for x in rivers)
out["rivers"] = {"count": len(rivers), "total_channel_length_in_country_km": r(tot_in,0),
                 "drainage_density_km_per_1000km2": r(1000*tot_in/A,2), "list": rivers}
# river density per climate / elevation
out["rivers"]["density_by_climate_km_per_1000km2"] = {}
allr = unary_union([LineString(ring_of(f["geometry"])) for f in rv if LineString(ring_of(f["geometry"])).intersects(C)]).intersection(C)
for k, u in clim_u.items():
    a = garea(u)
    if a > 100: out["rivers"]["density_by_climate_km_per_1000km2"][CLIM.get(k,k)] = r(1000*glen(allr.intersection(u))/2/a,2)
out["rivers"]["density_by_elevation_km_per_1000km2"] = {}
for k, u in alt_u.items():
    a = garea(u)
    if a > 100: out["rivers"]["density_by_elevation_km_per_1000km2"][ALT.get(k,k).split(" (")[0]] = r(1000*glen(allr.intersection(u))/2/a,2)
# largest river-free area: sample grid distance to nearest river inside country
far_r = max((Point(x, y) for x in [minx + i*(maxx-minx)/100 for i in range(101)] for y in [miny + j*(maxy-miny)/100 for j in range(101)]),
            key=lambda p: allr.distance(p) if C.contains(p) else -1)
nr = ops.nearest_points(far_r, allr)[1]
out["rivers"]["farthest_point_from_any_river"] = {"point": ll(far_r), "distance_km": r(G.inv(far_r.x, far_r.y, nr.x, nr.y)[2]/1e3,0)}

# Lakes & icecaps
for layer in ("lakes", "icecaps"):
    fs = load(layer)
    inside = []; nearest = []
    for f in fs:
        g = safe_shape(f["geometry"]).buffer(0)
        if g.is_empty: continue
        if g.intersects(C): inside.append({"id": f["properties"]["id"], "area_km2": r(garea(g.intersection(C)),1)})
        else:
            p1, p2 = ops.nearest_points(C, g)
            nearest.append((G.inv(p1.x, p1.y, p2.x, p2.y)[2]/1e3, f["properties"]["id"], garea(g), p2))
    nearest.sort()
    out[layer] = {"inside": inside, "nearest": [{"id": i, "distance_km": r(d,0), "area_km2": r(a,0), "at": ll(p)} for d, i, a, p in nearest[:3]]}

far2 = max((Point(x, y) for x in [minx + i*(maxx-minx)/120 for i in range(121)] for y in [miny + j*(maxy-miny)/120 for j in range(121)]),
           key=lambda p: landb.distance(p) if C.contains(p) else -1)
q = ops.nearest_points(far2, landb)[1]
out["farthest_from_any_sea"] = {"point": ll(far2), "distance_km": r(G.inv(far2.x, far2.y, q.x, q.y)[2]/1e3, 0), "nearest_sea_at": ll(q)}
# sampled elevation-class profile along the max span and along N-S / E-W lines through the centroid
def profile(p0, p1, n=60):
    rows = []
    for i in range(n+1):
        x = p0[0] + (p1[0]-p0[0])*i/n; y = p0[1] + (p1[1]-p0[1])*i/n; p = Point(x, y)
        if not C.contains(p): continue
        rows.append({"lng": r(x,2), "lat": r(y,2), "km": r(G.inv(p0[0], p0[1], x, y)[2]/1e3, 0),
                     "elevation": top_class(p, alt_all, ALT).split(" (")[0], "climate": top_class(p, clim_all, CLIM)})
    return rows
out["transects"] = {"N-S through centroid": profile((cen.x, maxy+0.1), (cen.x, miny-0.1), 50),
                    "W-E through centroid": profile((minx-0.1, cen.y), (maxx+0.1, cen.y), 50)}
json.dump(out, open(sys.argv[1], "w"), indent=2, default=str)
print("done")

# Interior structure: holes in the main Low Hills body (lowland basins/valleys enclosed by hills)
lh = max(alt_by["#c3d3a1"], key=garea)
from shapely.geometry import Polygon as _P
holes = sorted(((garea(_P(h)), _P(h)) for h in lh.interiors), key=lambda x: -x[0])
out["low_hills_enclosed_areas"] = [{"area_km2": r(a,0), "centre": ll(h.representative_point()), "bbox": [r(x,2) for x in h.bounds],
    "contains_elevation": {ALT.get(k,k).split(" (")[0]: r(garea(u.intersection(h)),0) for k, u in alt_u.items() if garea(u.intersection(h)) >= 1}}
    for a, h in holes if a >= 50]
# Coastal-lowland inland reach: max distance from own coast of any Coastal Lowlands point (grid)
cl = alt_u["#a8c995"]
pts = [Point(minx + i*(maxx-minx)/150, miny + j*(maxy-miny)/150) for i in range(151) for j in range(151)]
pts = [p for p in pts if cl.contains(p)]
fp = max(pts, key=lambda p: landb.distance(p)); q = ops.nearest_points(fp, landb)[1]
out["lowland_max_inland_reach"] = {"point": ll(fp), "km_from_sea": r(G.inv(fp.x, fp.y, q.x, q.y)[2]/1e3, 0)}
json.dump(out, open(sys.argv[1], "w"), indent=2, default=str)

# Share of each land border that runs along a drawn river (within 5 km of a river outline)
riv_all = unary_union(list(allrings.values()))
rb = {}
for nb in out["borders"]["neighbours"]:
    og = dict(others)[nb["name"]]
    seg = Cb.intersection(og.buffer(tol))
    along = seg.intersection(riv_all.buffer(0.045))
    rivs = sorted({rid for rid, rg in allrings.items() if glen(rg.intersection(seg.buffer(0.045))) > 20})
    rb[nb["name"]] = {"border_km": nb["shared_border_km"], "river_following_km": r(glen(along),0),
                      "pct": r(100*glen(along)/max(1, glen(seg)),1), "rivers": rivs}
out["river_borders"] = rb
json.dump(out, open(sys.argv[1], "w"), indent=2, default=str)
