/**
 * The physical layer engine's settings (png/layer-engine.ts): which pixels are land, ice, a zone or a band, how
 * small a region may be, and how traced edges are simplified and smoothed. Client-safe (a realm's map pipeline
 * config, edited in its admin panel, carries the settings that differ from these defaults).
 */
import { z } from "zod";

const pixels = z.number().int().min(0).max(10_000_000);

const riverOptionsSchema = z.object({
  /** Largest RGB distance from a river colour that is still river. */
  tolerance: z.number().min(0).max(128).default(24),
  /** River pixels this close (px) to water are its outline (a lake's, a coast's), not a river. */
  coastMargin: z.number().int().min(0).max(8).default(2),
  /** Shortest river system kept (px of line): shorter ones are labels, symbols and specks. */
  minLength: z.number().min(0).max(10_000).default(30),
  /** Longest branch off a fork (px) that is a spur, not a tributary. */
  spurLength: z.number().min(0).max(100).default(5),
  /** Douglas-Peucker tolerance (px). */
  simplify: z.number().min(0).max(10).default(0.75),
  /** Rounds of corner cutting after simplifying. */
  smooth: z.number().int().min(0).max(4).default(2),
  /** A corner cut is at most this many px. */
  maxCut: z.number().min(0).max(100).default(1),
});

export const layerEngineOptionsSchema = z.object({
  /** Land on the blank map: pixels whose R+G+B is below this. */
  landMaxSum: z.number().int().min(1).max(765).default(720),
  /** Water gaps up to this many px wide with land on both sides are drawn border lines: land. 0 keeps them. */
  lineWidth: z.number().int().min(0).max(32).default(5),
  /** How far (CIEDE2000) a climate map pixel may be from a zone colour and still be that zone. */
  climateTolerance: z.number().min(1).max(40).default(6),
  /** Ice: land pixels of the ice image whose darkest channel is above this. */
  iceMinChannel: z.number().int().min(0).max(255).default(235),
  /** How far (CIEDE2000) a geography map pixel may be from a band's tint and still be that band. */
  elevationTolerance: z.number().min(1).max(40).default(5),
  /** 5 × 5 mode-filter passes over the elevation bands (rounds their pixel steps). */
  elevationSmoothing: z.number().int().min(0).max(8).default(2),
  /** Regions under this many px merge into their largest neighbour (lakes into land, zone specks into zones). */
  minRegionPixels: z
    .object({
      land: pixels.default(12),
      climate: pixels.default(512),
      icecaps: pixels.default(4000),
      elevation: pixels.default(64),
    })
    .prefault({}),
  /** Topological simplification: smallest triangle (px²) a vertex may span and still be kept. */
  simplify: z.number().min(0).max(100).default(1.5),
  /** Rounds of Chaikin corner cutting on the simplified arcs (0: none). */
  smooth: z.number().int().min(0).max(4).default(2),
  /** A smoothing cut is a quarter of the edge, at most this many px from the corner. */
  smoothMaxCut: z.number().min(0).max(100).default(1),
  /** After smoothing, vertices spanning less than this triangle (px²) are dropped. */
  smoothPrune: z.number().min(0).max(10).default(0.35),
  rivers: riverOptionsSchema.prefault({}),
});
export type LayerEngineOptions = z.infer<typeof layerEngineOptionsSchema>;
