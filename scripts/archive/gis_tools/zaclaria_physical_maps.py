"""Render elevation / climate / hydrography maps for Zaclaria.

Usage: python3 scripts/archive/gis_tools/zaclaria_physical_maps.py REPORT.json  (writes PNGs to cwd)
"""
import json, sys, os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "zaclaria_physical_report.py")).read().split("out = {}")[0])  # reuse helpers/legends
from shapely.geometry import shape, LineString
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MP, Patch
from matplotlib.lines import Line2D
pol = load("political")
def unwrap(g):
    ps = [p for p in polys(g) if (p.bounds[2]-p.bounds[0]) < 180]
    return unary_union(ps) if ps else None
C = shape(next(f for f in pol if f["properties"]["id"] == NAME)["geometry"]).buffer(0)
minx, miny, maxx, maxy = C.bounds; pad = 1.2
view = box(minx-pad, miny-pad, maxx+pad, maxy+pad)
def draw(ax, g, **kw):
    for p in polys(g):
        ax.add_patch(MP(list(p.exterior.coords), closed=True, **kw))
        for h in p.interiors: ax.add_patch(MP(list(h.coords), closed=True, facecolor="none", edgecolor=kw.get("edgecolor","none"), lw=kw.get("lw",0)))
def layer(ax, name, legend, clip):
    used = {}
    for f in load(name):
        g = unwrap(safe_shape(f["geometry"]).buffer(0))
        if g is None or not g.intersects(clip): continue
        fill = f["properties"]["fill"]
        draw(ax, g.intersection(clip), facecolor=fill, edgecolor="none", lw=0)
        if g.intersects(C): used[fill] = legend.get(fill, fill)
    return used
rings = [(f["properties"]["id"], LineString(f["geometry"]["coordinates"] if f["geometry"]["type"]=="LineString" else max(f["geometry"]["coordinates"], key=len))) for f in load("rivers")]
labels = json.load(open(sys.argv[1]))["rivers"]["list"]
lab = {x["id"]: f"R{i+1}" for i, x in enumerate(labels)}
def base(ax, title):
    ax.set_facecolor("#d5ffff")
    for f in pol:
        g = unwrap(shape(f["geometry"]).buffer(0))
        if g is None or not g.intersects(view): continue
        draw(ax, g.intersection(view), facecolor="#eeeeee" if f["properties"]["id"] != NAME else "none", edgecolor="#777", lw=0.4)
        if f["properties"]["id"] not in (NAME,) and g.intersection(view).area > 0.5:
            c = g.intersection(view).representative_point(); ax.text(c.x, c.y, f["properties"]["id"], fontsize=7, color="#555", ha="center")
    ax.set_xlim(minx-pad, maxx+pad); ax.set_ylim(miny-pad, maxy+pad); ax.set_aspect("equal")
    ax.set_title(title, fontsize=11); ax.set_xlabel("Longitude °E"); ax.set_ylabel("Latitude °N"); ax.grid(ls=":", lw=0.4, color="#888")
def outline(ax):
    draw(ax, C, facecolor="none", edgecolor="black", lw=1.4)
def rivers(ax, color="#1f5fff", labels_on=True):
    for rid, rg in rings:
        if not rg.intersects(view): continue
        g = rg.intersection(view)
        for l in lines(g):
            xs, ys = zip(*l.coords); ax.plot(xs, ys, color=color, lw=0.9)
        if rid in lab and labels_on:
            p = rg.intersection(C).representative_point() if rg.intersects(C) else rg.representative_point()
            ax.text(p.x, p.y, lab[rid], fontsize=8, color="#002a8a", weight="bold", bbox=dict(boxstyle="round,pad=0.1", fc="white", ec="none", alpha=0.7))
for name, legend, title, fn in [("altitudes", ALT, "Zaclaria — elevation classes (altitudes.geojson)", "zaclaria-elevation.png"),
                                ("climate", CLIM, "Zaclaria — climate classes (climate.geojson)", "zaclaria-climate.png")]:
    fig, ax = plt.subplots(figsize=(10, 10), dpi=130)
    base(ax, title); used = layer(ax, name, legend, C); outline(ax); rivers(ax, labels_on=False)
    order = [k for k in legend if k in used]
    ax.legend(handles=[Patch(facecolor=k, edgecolor="#444", label=legend[k]) for k in order] + [Line2D([], [], color="#1f5fff", label="Rivers")], loc="lower left", fontsize=8)
    fig.tight_layout(); fig.savefig(fn); plt.close(fig)
fig, ax = plt.subplots(figsize=(10, 10), dpi=130)
base(ax, "Zaclaria — hydrography (rivers.geojson), labels R1–R9 by in-country length")
draw(ax, C, facecolor="#f1f4a8", edgecolor="black", lw=1.4); rivers(ax)
d = json.load(open(sys.argv[1]))
for x in labels:
    for t, m in ((x["source"], "^"), (x["mouth"], "v")):
        ax.plot(t["lng"], t["lat"], m, color="#c00" if m == "^" else "#060", ms=6)
ax.legend(handles=[Line2D([], [], color="#1f5fff", label="River channel"), Line2D([], [], marker="^", ls="", color="#c00", label="Source / upper end"),
                   Line2D([], [], marker="v", ls="", color="#060", label="Mouth / confluence")], loc="lower left", fontsize=8)
fig.tight_layout(); fig.savefig("zaclaria-hydrography.png"); plt.close(fig)
print("ok")
