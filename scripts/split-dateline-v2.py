#!/usr/bin/env python3
"""
Split GeoJSON polygons that cross the dateline - Version 2.
This creates SEPARATE features for each split part.
"""

import json
import sys
import os

def normalize_longitude(lon):
    """Normalize longitude to [-180, 180] range."""
    while lon > 180:
        lon -= 360
    while lon < -180:
        lon += 360
    return lon

def process_geojson(input_file, output_file):
    """
    Process a GeoJSON file, splitting dateline-crossing features into separate features.
    """
    print(f"Processing {input_file}...")

    with open(input_file, 'r') as f:
        data = json.load(f)

    new_features = []
    split_count = 0

    for feature in data['features']:
        geom = feature['geometry']
        props = feature['properties']
        feature_id = props.get('id', 'unnamed')

        if geom['type'] == 'MultiPolygon':
            # Check for dateline crossing
            has_crossing = False
            parts_to_split = []

            for polygon_idx, polygon in enumerate(geom['coordinates']):
                outer_ring = polygon[0]

                # Calculate the longitude span
                lons = [coord[0] for coord in outer_ring]
                min_lon = min(lons)
                max_lon = max(lons)

                # Check for dateline crossing - large span or presence of both extreme values
                if (max_lon - min_lon) > 350:  # Nearly wraps around the globe
                    has_crossing = True

                    # Separate points into east and west of center
                    east_points = []
                    west_points = []

                    for coord in outer_ring:
                        lon, lat = coord
                        if lon > 0:
                            east_points.append([lon, lat])
                        else:
                            west_points.append([lon, lat])

                    # Create separate polygons for east and west
                    if east_points and len(east_points) > 3:
                        # Shift eastern points past 180 to negative
                        east_polygon = []
                        for lon, lat in east_points:
                            if lon > 170:  # Points near the eastern edge
                                east_polygon.append([lon - 360, lat])
                            else:
                                east_polygon.append([lon, lat])

                        # Close the ring
                        if east_polygon and east_polygon[0] != east_polygon[-1]:
                            east_polygon.append(east_polygon[0])

                        if len(east_polygon) > 3:
                            parts_to_split.append([[east_polygon]])

                    if west_points and len(west_points) > 3:
                        # Shift western points past -180 to positive
                        west_polygon = []
                        for lon, lat in west_points:
                            if lon < -170:  # Points near the western edge
                                west_polygon.append([lon + 360, lat])
                            else:
                                west_polygon.append([lon, lat])

                        # Close the ring
                        if west_polygon and west_polygon[0] != west_polygon[-1]:
                            west_polygon.append(west_polygon[0])

                        if len(west_polygon) > 3:
                            parts_to_split.append([[west_polygon]])
                else:
                    # No crossing, keep as is
                    parts_to_split.append([polygon])

            if has_crossing:
                split_count += 1
                print(f"  Splitting {feature_id} into {len(parts_to_split)} parts")

                # Create separate features for each part
                for part_idx, part_coords in enumerate(parts_to_split):
                    new_feature = {
                        'type': 'Feature',
                        'properties': props.copy(),
                        'geometry': {
                            'type': 'MultiPolygon',
                            'coordinates': part_coords
                        }
                    }
                    # Add part indicator to properties
                    if len(parts_to_split) > 1:
                        new_feature['properties']['_part'] = part_idx + 1
                    new_features.append(new_feature)
            else:
                # No crossing, keep original
                new_features.append(feature)
        else:
            # Not a MultiPolygon, keep as-is
            new_features.append(feature)

    # Create output GeoJSON
    output_data = {
        'type': 'FeatureCollection',
        'features': new_features
    }

    with open(output_file, 'w') as f:
        json.dump(output_data, f)

    print(f"  Original features: {len(data['features'])}")
    print(f"  Split features: {split_count}")
    print(f"  Total output features: {len(new_features)}")
    print(f"  Output: {output_file}")

def main():
    """
    Process all GeoJSON files in the geojson_sanitized directory.
    """
    source_dir = "/ixwiki/public/projects/ixstats/scripts/geojson_sanitized"
    output_dir = "/ixwiki/public/projects/ixstats/scripts/geojson_split_v2"

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Only process political for now to test
    layers = ['political']

    for layer in layers:
        input_file = os.path.join(source_dir, f"{layer}.geojson")
        output_file = os.path.join(output_dir, f"{layer}.geojson")

        if os.path.exists(input_file):
            process_geojson(input_file, output_file)
        else:
            print(f"Skipping {layer}: file not found")

    print("\nDone! Split GeoJSON files are in scripts/geojson_split_v2/")

if __name__ == "__main__":
    main()