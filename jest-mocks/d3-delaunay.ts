// Load the pre-bundled UMD version of d3-delaunay so Jest/Node tests can execute synchronously
import * as fs from "fs";
import * as path from "path";

const fullPath = path.resolve(__dirname, "../node_modules/d3-delaunay/dist/d3-delaunay.js");
const code = fs.readFileSync(fullPath, "utf8");
const fn = new Function("exports", "require", "module", "__filename", "__dirname", code);
const mod = { exports: {} as any };
fn(mod.exports, require, mod, fullPath, path.dirname(fullPath));

export const Delaunay = mod.exports.Delaunay;
export const Voronoi = mod.exports.Voronoi;
export default mod.exports;
