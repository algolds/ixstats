#!/usr/bin/env python3
"""
Fix dateline-crossing polygons by shifting coordinates.
For countries that cross the dateline, shift all negative longitudes to positive (add 360)
so they're represented as crossing 180° instead of wrapping around the globe.
"""

import json
import os

def fix_dateline_crossing(input_file, output_file):
    """
    Process a GeoJSON file and fix dateline-crossing features.
    """
    print(f"Processing {input_file}...")

    with open(input_file, 'r') as f:
        data = json.load(f)

    fixed_count = 0

    for feature in data['features']:
        geom = feature['geometry']
        feature_id = feature['properties'].get('id', 'unnamed')

        if geom['type'] == 'MultiPolygon':
            # Collect all longitudes to check span
            all_lons = []
            for polygon in geom['coordinates']:
                for ring in polygon:
                    for coord in ring:
                        all_lons.append(coord[0])

            if all_lons:
                min_lon = min(all_lons)
                max_lon = max(all_lons)

                # Check if this crosses the dateline
                # If we have both very negative and very positive values, it crosses
                if min_lon < -170 and max_lon > 170:
                    fixed_count += 1
                    print(f"  Fixing {feature_id}: lon range [{min_lon:.1f}, {max_lon:.1f}]")

                    # Shift all negative longitudes to positive (add 360)
                    # This represents the country as being between ~170 and ~190 degrees
                    for polygon in geom['coordinates']:
                        for ring in polygon:
                            for i, coord in enumerate(ring):
                                lon, lat = coord[0], coord[1]
                                if lon < 0:
                                    ring[i] = [lon + 360, lat]

                    # Verify the fix
                    new_lons = []
                    for polygon in geom['coordinates']:
                        for ring in polygon:
                            for coord in ring:
                                new_lons.append(coord[0])
                    if new_lons:
                        print(f"    -> New range: [{min(new_lons):.1f}, {max(new_lons):.1f}]")

    # Write the fixed GeoJSON
    with open(output_file, 'w') as f:
        json.dump(data, f, separators=(',', ':'))

    print(f"  Fixed {fixed_count} dateline-crossing features")
    print(f"  Output: {output_file}")

def main():
    """
    Process all GeoJSON files.
    """
    source_dir = "/ixwiki/public/projects/ixstats/scripts/geojson_sanitized"
    output_dir = "/ixwiki/public/projects/ixstats/scripts/geojson_fixed"

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Process all layers
    layers = ['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background']

    for layer in layers:
        input_file = os.path.join(source_dir, f"{layer}.geojson")
        output_file = os.path.join(output_dir, f"{layer}.geojson")

        if os.path.exists(input_file):
            fix_dateline_crossing(input_file, output_file)
        else:
            print(f"Skipping {layer}: file not found")

    print("\nDone! Fixed GeoJSON files are in scripts/geojson_fixed/")
    print("Now import these with ogr2ogr (no special options needed).")

if __name__ == "__main__":
    main()