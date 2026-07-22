export class Delaunay {
  points: Float64Array;
  halfedges: Int32Array;
  hull: Uint32Array;
  triangles: Uint32Array;
  inedges: Int32Array;

  constructor(points: Float64Array) {
    this.points = points;
    this.halfedges = new Int32Array(points.length * 2);
    this.hull = new Uint32Array(points.length);
    this.triangles = new Uint32Array(points.length * 2);
    this.inedges = new Int32Array(points.length);
  }

  static from(points: number[][]) {
    const flat = new Float64Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      flat[i * 2] = points[i][0];
      flat[i * 2 + 1] = points[i][1];
    }
    return new Delaunay(flat);
  }

  neighbors(i: number) {
    const n = Math.floor(this.points.length / 2);
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    return [prev, next][Symbol.iterator]();
  }

  voronoi(bounds: [number, number, number, number]) {
    return {
      cellPolygon: (i: number) => [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[1]],
        [bounds[2], bounds[3]],
        [bounds[0], bounds[3]],
        [bounds[0], bounds[1]],
      ],
    };
  }
}
