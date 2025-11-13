#!/usr/bin/env python3
"""
Split GeoJSON polygons that cross the dateline.
This script processes GeoJSON files and splits any polygons that cross
the international dateline (180°/-180°) into separate parts.
"""

import json
import sys
import os
from typing import List, Tuple, Dict, Any

def crosses_dateline(coords: List[Tuple[float, float]]) -> bool:
    """
    Check if a polygon ring crosses the dateline.
    A polygon crosses the dateline if it has a very large longitude jump (>180°).
    """
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        # Check for large jumps indicating dateline crossing
        if abs(lon2 - lon1) > 180:
            return True
    return False

def split_polygon_at_dateline(coords: List[Tuple[float, float]]) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
    """
    Split a polygon ring at the dateline into western and eastern parts.
    """
    west_part = []
    east_part = []
    current_part = []
    is_west = True  # Track which side we're on

    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]

        current_part.append([lon1, lat1])

        # Check for dateline crossing
        if abs(lon2 - lon1) > 180:
            # We're crossing the dateline
            # Interpolate the crossing point
            if lon1 > 0:  # Going from east to west
                # Add interpolated point at +180
                ratio = (180 - lon1) / ((lon2 + 360) - lon1)
                lat_cross = lat1 + ratio * (lat2 - lat1)
                current_part.append([180, lat_cross])

                if is_west:
                    west_part = current_part
                else:
                    east_part = current_part

                # Start new part on the other side
                current_part = [[-180, lat_cross]]
                is_west = not is_west
            else:  # Going from west to east
                # Add interpolated point at -180
                ratio = (-180 - lon1) / ((lon2 - 360) - lon1)
                lat_cross = lat1 + ratio * (lat2 - lat1)
                current_part.append([-180, lat_cross])

                if is_west:
                    west_part = current_part
                else:
                    east_part = current_part

                # Start new part on the other side
                current_part = [[180, lat_cross]]
                is_west = not is_west

    # Add the last point
    if coords:
        current_part.append(coords[-1])

    # Assign the final part
    if is_west:
        west_part = current_part if not west_part else west_part + current_part[1:]
    else:
        east_part = current_part if not east_part else east_part + current_part[1:]

    # Make sure both parts are closed rings
    if west_part and west_part[0] != west_part[-1]:
        west_part.append(west_part[0])
    if east_part and east_part[0] != east_part[-1]:
        east_part.append(east_part[0])

    return west_part, east_part

def process_multipolygon(multipolygon_coords: List) -> List:
    """
    Process a MultiPolygon, splitting any parts that cross the dateline.
    """
    result_polygons = []

    for polygon in multipolygon_coords:
        # For each polygon (which may have multiple rings - outer + holes)
        outer_ring = polygon[0]  # First ring is the outer boundary
        holes = polygon[1:] if len(polygon) > 1 else []

        if crosses_dateline(outer_ring):
            # Split the outer ring
            west_part, east_part = split_polygon_at_dateline(outer_ring)

            if west_part and len(west_part) > 3:  # Valid polygon needs at least 4 points (closed ring)
                result_polygons.append([west_part])
            if east_part and len(east_part) > 3:
                result_polygons.append([east_part])

            # Note: Holes are ignored for simplicity - they would need special handling
        else:
            # No crossing, keep as-is
            result_polygons.append(polygon)

    return result_polygons

def process_geojson(input_file: str, output_file: str):
    """
    Process a GeoJSON file, splitting dateline-crossing features.
    """
    print(f"Processing {input_file}...")

    with open(input_file, 'r') as f:
        data = json.load(f)

    features = data['features']
    new_features = []
    split_count = 0

    for feature in features:
        geom = feature['geometry']

        if geom['type'] == 'MultiPolygon':
            coords = geom['coordinates']

            # Check if any part crosses the dateline
            needs_split = any(
                crosses_dateline(polygon[0])  # Check outer ring of each polygon
                for polygon in coords
            )

            if needs_split:
                split_count += 1
                print(f"  Splitting: {feature['properties'].get('id', 'unnamed')}")

                # Process and split the multipolygon
                new_coords = process_multipolygon(coords)

                # Update the geometry with split coordinates
                feature_copy = feature.copy()
                feature_copy['geometry'] = {
                    'type': 'MultiPolygon',
                    'coordinates': new_coords
                }
                new_features.append(feature_copy)
            else:
                # Keep as-is
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

    print(f"  Split {split_count} features")
    print(f"  Output: {output_file}")

def main():
    """
    Process all GeoJSON files in the geojson_sanitized directory.
    """
    source_dir = "/ixwiki/public/projects/ixstats/scripts/geojson_sanitized"
    output_dir = "/ixwiki/public/projects/ixstats/scripts/geojson_split"

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Process each GeoJSON file
    layers = ['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background']

    for layer in layers:
        input_file = os.path.join(source_dir, f"{layer}.geojson")
        output_file = os.path.join(output_dir, f"{layer}.geojson")

        if os.path.exists(input_file):
            process_geojson(input_file, output_file)
        else:
            print(f"Skipping {layer}: file not found")

    print("\nDone! Split GeoJSON files are in scripts/geojson_split/")
    print("Now run the import script with the split files.")

if __name__ == "__main__":
    main()