/**
 * Projection Information Panel
 *
 * Educational component explaining map projections, their tradeoffs, and distortion characteristics.
 * Helps users understand why different projections show different sizes and shapes.
 */

"use client";

import React from "react";
import { RiCloseLine, RiEarthLine, RiInformationLine } from "react-icons/ri";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

interface ProjectionInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectionInfoPanel({ isOpen, onClose }: ProjectionInfoPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="glass-hierarchy-modal glass-refraction max-h-[90vh] max-w-3xl overflow-y-auto border-white/20 bg-black/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <RiEarthLine className="h-6 w-6 text-purple-400" />
            <CardTitle className="text-foreground">Understanding Map Projections</CardTitle>
          </div>
          <button onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/10">
            <RiCloseLine className="h-5 w-5 text-white/60" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Introduction */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <RiInformationLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
              <div>
                <h3 className="mb-2 font-semibold text-blue-300">The Projection Problem</h3>
                <p className="text-xs leading-relaxed text-blue-200/80">
                  Earth is a 3D sphere, but maps are 2D flat surfaces.{" "}
                  <strong>It's mathematically impossible</strong> to perfectly represent a sphere on
                  a flat surface without some distortion. Every map projection sacrifices something
                  - whether it's shape, area, distance, or direction.
                </p>
              </div>
            </div>
          </div>

          {/* Projection Comparison Table */}
          <div>
            <h3 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
              <span className="text-purple-400">📊</span> Projection Comparison
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-2 text-left font-medium text-white/80">Projection</th>
                    <th className="p-2 text-left font-medium text-white/80">Type</th>
                    <th className="p-2 text-left font-medium text-white/80">Best For</th>
                    <th className="p-2 text-left font-medium text-white/80">Distortion</th>
                    <th className="p-2 text-center font-medium text-white/80">Preserves</th>
                  </tr>
                </thead>
                <tbody className="text-white/70">
                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2">
                      <div className="font-medium text-white">Web Mercator</div>
                      <div className="text-[10px] text-white/50">EPSG:3857</div>
                    </td>
                    <td className="p-2">Cylindrical</td>
                    <td className="p-2">Navigation, web maps</td>
                    <td className="p-2">
                      <span className="text-amber-400">⚠ High</span> at poles
                      <div className="text-[10px] text-white/50">~1700% at 85°</div>
                    </td>
                    <td className="p-2 text-center">
                      <span className="text-green-400">Shapes</span>
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2">
                      <div className="font-medium text-white">Globe (3D)</div>
                      <div className="text-[10px] text-white/50">Orthographic</div>
                    </td>
                    <td className="p-2">Perspective</td>
                    <td className="p-2">World view, education</td>
                    <td className="p-2">
                      <span className="text-green-400">✓ None</span>
                      <div className="text-[10px] text-white/50">Accurate 3D</div>
                    </td>
                    <td className="p-2 text-center">
                      <span className="text-green-400">All</span>
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2">
                      <div className="font-medium text-white">Equal Earth</div>
                      <div className="text-[10px] text-amber-400">Coming in v1.2</div>
                    </td>
                    <td className="p-2">Pseudocylindrical</td>
                    <td className="p-2">Data visualization, thematic maps</td>
                    <td className="p-2">
                      <span className="text-green-400">✓ Minimal</span>
                      <div className="text-[10px] text-white/50">Balanced distortion</div>
                    </td>
                    <td className="p-2 text-center">
                      <span className="text-green-400">Areas</span>
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2">
                      <div className="font-medium text-white">Natural Earth</div>
                      <div className="text-[10px] text-amber-400">Coming in v1.2</div>
                    </td>
                    <td className="p-2">Pseudocylindrical</td>
                    <td className="p-2">General reference, aesthetics</td>
                    <td className="p-2">
                      <span className="text-green-400">✓ Minimal</span>
                      <div className="text-[10px] text-white/50">Balanced compromise</div>
                    </td>
                    <td className="p-2 text-center">
                      <span className="text-blue-400">Balance</span>
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2">
                      <div className="font-medium text-white">IxMaps Linear</div>
                      <div className="text-[10px] text-amber-400">Coming in v1.2</div>
                    </td>
                    <td className="p-2">Equirectangular</td>
                    <td className="p-2">IxEarth visualization</td>
                    <td className="p-2">
                      <span className="text-yellow-400">⚠ Medium</span>
                      <div className="text-[10px] text-white/50">Custom scale</div>
                    </td>
                    <td className="p-2 text-center">
                      <span className="text-purple-400">Custom</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mercator Distortion Explained */}
          <div>
            <h3 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
              <span className="text-amber-400">⚠</span> Web Mercator Distortion
            </h3>

            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <h4 className="mb-2 text-sm font-medium text-amber-300">
                  Area Distortion by Latitude
                </h4>
                <div className="space-y-1 text-xs text-amber-200/80">
                  <div className="flex items-center justify-between">
                    <span>Equator (0°)</span>
                    <span className="text-green-400">100% - Accurate</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mid-latitudes (45°)</span>
                    <span className="text-yellow-400">~140% distortion</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>High latitudes (70°)</span>
                    <span className="text-orange-400">~300% distortion</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Polar regions (85°)</span>
                    <span className="text-red-400">~1700% distortion!</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <h4 className="mb-2 text-sm font-medium text-white">Famous Examples</h4>
                <div className="space-y-2 text-xs text-white/70">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 text-purple-400">🗺️</span>
                    <p>
                      <strong className="text-white">Greenland vs. Africa:</strong> Greenland
                      appears similar in size to Africa on Mercator maps. In reality,{" "}
                      <strong className="text-green-400">Africa is 14x larger</strong>!
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 text-purple-400">🗺️</span>
                    <p>
                      <strong className="text-white">Antarctica:</strong> Appears as a massive
                      continent spanning the entire bottom of the map. It's stretched infinitely due
                      to Mercator's mathematical limitations.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 text-purple-400">🗺️</span>
                    <p>
                      <strong className="text-white">Russia vs. Canada:</strong> Both appear
                      enormous due to their high latitudes. Equal Earth projection shows their true
                      relative sizes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Equal Earth Benefits */}
          <div>
            <h3 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
              <span className="text-green-400">✓</span> Why Equal Earth is Better for Data
            </h3>

            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
              <ul className="space-y-2 text-xs text-green-200/80">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <p>
                    <strong className="text-green-300">Accurate area comparison:</strong> Countries
                    shown at their true relative sizes
                  </p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <p>
                    <strong className="text-green-300">No polar distortion:</strong> High-latitude
                    regions appear at correct sizes
                  </p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <p>
                    <strong className="text-green-300">Perfect for thematic maps:</strong>{" "}
                    Population, GDP, resources shown accurately
                  </p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <p>
                    <strong className="text-green-300">Visually pleasing:</strong> Balanced
                    aesthetics without extreme distortion
                  </p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 text-green-400">✓</span>
                  <p>
                    <strong className="text-green-300">Modern standard:</strong> Increasingly used
                    by National Geographic and data journalists
                  </p>
                </li>
              </ul>
            </div>
          </div>

          {/* When to Use Each Projection */}
          <div>
            <h3 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
              <span className="text-blue-400">💡</span> When to Use Each Projection
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <h4 className="mb-1 text-sm font-medium text-blue-300">🗺️ Use Web Mercator for:</h4>
                <ul className="ml-4 list-disc space-y-1 text-xs text-blue-200/80">
                  <li>Street maps and navigation</li>
                  <li>Web applications (Google Maps, OpenStreetMap)</li>
                  <li>Detailed city or regional views</li>
                  <li>When shape preservation is critical</li>
                </ul>
              </div>

              <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
                <h4 className="mb-1 text-sm font-medium text-purple-300">🌍 Use Globe (3D) for:</h4>
                <ul className="ml-4 list-disc space-y-1 text-xs text-purple-200/80">
                  <li>World-scale overview</li>
                  <li>Understanding spatial relationships</li>
                  <li>Presentations and demonstrations</li>
                  <li>True perspective viewing</li>
                </ul>
              </div>

              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                <h4 className="mb-1 text-sm font-medium text-green-300">🌎 Use Equal Earth for:</h4>
                <ul className="ml-4 list-disc space-y-1 text-xs text-green-200/80">
                  <li>Comparing country sizes or areas</li>
                  <li>Population density maps</li>
                  <li>Economic data visualization (GDP, trade)</li>
                  <li>Environmental/climate maps</li>
                  <li>Educational materials</li>
                </ul>
              </div>

              <div className="rounded-lg border border-teal-500/20 bg-teal-500/10 p-3">
                <h4 className="mb-1 text-sm font-medium text-teal-300">🗺️ Use Natural Earth for:</h4>
                <ul className="ml-4 list-disc space-y-1 text-xs text-teal-200/80">
                  <li>General reference maps</li>
                  <li>Wall maps and print media</li>
                  <li>Aesthetic world visualizations</li>
                  <li>Balanced representation without extreme distortion</li>
                </ul>
              </div>

              <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3">
                <h4 className="mb-1 text-sm font-medium text-purple-300">🎯 Use IxMaps Linear for:</h4>
                <ul className="ml-4 list-disc space-y-1 text-xs text-purple-200/80">
                  <li>Aligning with ixmaps-new coordinate system</li>
                  <li>Custom IxEarth prime meridian (30°)</li>
                  <li>Fast linear transformations</li>
                  <li>Legacy IxMaps compatibility</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Implementation Status */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <h3 className="text-foreground mb-2 flex items-center gap-2 font-semibold text-amber-300">
              <span>🚧</span> Custom Projections Status
            </h3>
            <div className="space-y-2 text-xs text-amber-200/90">
              <p>
                <strong>Equal Earth</strong>, <strong>Natural Earth</strong>, and <strong>IxMaps Linear</strong> projections are in development for v1.2.
              </p>
              <p>
                <strong>Why they're complex:</strong>
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>MapLibre GL JS only natively supports Mercator and Globe projections</li>
                <li>Custom projections require server-side tile generation in the target projection</li>
                <li>OR client-side canvas redraw using D3-geo (performance intensive)</li>
                <li>Vector tile coordinate transformation is computationally expensive</li>
              </ul>
              <p className="mt-2">
                <strong>Current Status:</strong> Infrastructure complete (D3-geo integration, projection definitions, coordinate transformers). Awaiting Martin tile server configuration for custom projection tile generation.
              </p>
            </div>
          </div>

          {/* Learn More */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <h4 className="mb-2 text-sm font-medium text-white">📚 Learn More</h4>
            <div className="space-y-1 text-xs text-white/60">
              <p>
                •{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Web_Mercator_projection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  Web Mercator Projection (Wikipedia)
                </a>
              </p>
              <p>
                •{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Equal_Earth_projection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  Equal Earth Projection (Wikipedia)
                </a>
              </p>
              <p>
                •{" "}
                <a
                  href="https://thetruesize.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  The True Size Of... (Interactive Tool)
                </a>
              </p>
              <p>
                •{" "}
                <a
                  href="https://www.jasondavies.com/maps/transition/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  Map Projection Transitions (Interactive)
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
