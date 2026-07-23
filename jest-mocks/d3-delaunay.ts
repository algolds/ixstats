// Use requireActual so tests use the real d3-delaunay package
const actual = jest.requireActual("d3-delaunay");

export const Delaunay = actual.Delaunay;
export default actual;
