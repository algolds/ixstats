/**
 * Projection Information Panel
 *
 * Educational component explaining map projections, their tradeoffs, and distortion characteristics.
 * Helps users understand why different projections show different sizes and shapes.
 */

"use client";

import React from 'react';
import { RiCloseLine, RiEarthLine, RiInformationLine } from 'react-icons/ri';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';

interface ProjectionInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectionInfoPanel({ isOpen, onClose }: ProjectionInfoPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <Card className="bg-black/90 border-white/20 glass-hierarchy-modal glass-refraction max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <RiEarthLine className="text-purple-400 w-6 h-6" />
            <CardTitle className="text-foreground">Understanding Map Projections</CardTitle>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <RiCloseLine className="w-5 h-5 text-white/60" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Introduction */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <RiInformationLine className="text-blue-400 w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-300 mb-2">The Projection Problem</h3>
                <p className="text-xs text-blue-200/80 leading-relaxed">
                  Earth is a 3D sphere, but maps are 2D flat surfaces. <strong>It's mathematically impossible</strong> to perfectly
                  represent a sphere on a flat surface without some distortion. Every map projection sacrifices something - whether
                  it's shape, area, distance, or direction.
                </p>
              </div>
            </div>
          </div>

          {/* Projection Comparison Table */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-purple-400">📊</span> Projection Comparison
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-2 text-white/80 font-medium">Projection</th>
                    <th className="text-left p-2 text-white/80 font-medium">Type</th>
                    <th className="text-left p-2 text-white/80 font-medium">Best For</th>
                    <th className="text-left p-2 text-white/80 font-medium">Distortion</th>
                    <th className="text-center p-2 text-white/80 font-medium">Preserves</th>
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
                      <div className="font-medium text-white">Equal Earth</div>
                      <div className="text-[10px] text-white/50">Equal-area</div>
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
                </tbody>
              </table>
            </div>
          </div>

          {/* Mercator Distortion Explained */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-amber-400">⚠</span> Web Mercator Distortion
            </h3>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <h4 className="font-medium text-amber-300 mb-2 text-sm">Area Distortion by Latitude</h4>
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

              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h4 className="font-medium text-white mb-2 text-sm">Famous Examples</h4>
                <div className="space-y-2 text-xs text-white/70">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">🗺️</span>
                    <p>
                      <strong className="text-white">Greenland vs. Africa:</strong> Greenland appears similar in size to Africa
                      on Mercator maps. In reality, <strong className="text-green-400">Africa is 14x larger</strong>!
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">🗺️</span>
                    <p>
                      <strong className="text-white">Antarctica:</strong> Appears as a massive continent spanning the entire bottom
                      of the map. It's stretched infinitely due to Mercator's mathematical limitations.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 flex-shrink-0">🗺️</span>
                    <p>
                      <strong className="text-white">Russia vs. Canada:</strong> Both appear enormous due to their high latitudes.
                      Equal Earth projection shows their true relative sizes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Equal Earth Benefits */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-green-400">✓</span> Why Equal Earth is Better for Data
            </h3>

            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <ul className="space-y-2 text-xs text-green-200/80">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <p><strong className="text-green-300">Accurate area comparison:</strong> Countries shown at their true relative sizes</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <p><strong className="text-green-300">No polar distortion:</strong> High-latitude regions appear at correct sizes</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <p><strong className="text-green-300">Perfect for thematic maps:</strong> Population, GDP, resources shown accurately</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <p><strong className="text-green-300">Visually pleasing:</strong> Balanced aesthetics without extreme distortion</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  <p><strong className="text-green-300">Modern standard:</strong> Increasingly used by National Geographic and data journalists</p>
                </li>
              </ul>
            </div>
          </div>

          {/* When to Use Each Projection */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-blue-400">💡</span> When to Use Each Projection
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <h4 className="font-medium text-blue-300 mb-1 text-sm">🗺️ Use Web Mercator for:</h4>
                <ul className="text-xs text-blue-200/80 space-y-1 ml-4 list-disc">
                  <li>Street maps and navigation</li>
                  <li>Web applications (Google Maps, OpenStreetMap)</li>
                  <li>Detailed city or regional views</li>
                  <li>When shape preservation is critical</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <h4 className="font-medium text-green-300 mb-1 text-sm">🌎 Use Equal Earth for:</h4>
                <ul className="text-xs text-green-200/80 space-y-1 ml-4 list-disc">
                  <li>Comparing country sizes or areas</li>
                  <li>Population density maps</li>
                  <li>Economic data visualization (GDP, trade)</li>
                  <li>Environmental/climate maps</li>
                  <li>Educational materials</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <h4 className="font-medium text-purple-300 mb-1 text-sm">🌍 Use Globe (3D) for:</h4>
                <ul className="text-xs text-purple-200/80 space-y-1 ml-4 list-disc">
                  <li>World-scale overview</li>
                  <li>Understanding spatial relationships</li>
                  <li>Presentations and demonstrations</li>
                  <li>True perspective viewing</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Learn More */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <h4 className="font-medium text-white mb-2 text-sm">📚 Learn More</h4>
            <div className="space-y-1 text-xs text-white/60">
              <p>• <a href="https://en.wikipedia.org/wiki/Web_Mercator_projection" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Web Mercator Projection (Wikipedia)</a></p>
              <p>• <a href="https://en.wikipedia.org/wiki/Equal_Earth_projection" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Equal Earth Projection (Wikipedia)</a></p>
              <p>• <a href="https://thetruesize.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">The True Size Of... (Interactive Tool)</a></p>
              <p>• <a href="https://www.jasondavies.com/maps/transition/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Map Projection Transitions (Interactive)</a></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
