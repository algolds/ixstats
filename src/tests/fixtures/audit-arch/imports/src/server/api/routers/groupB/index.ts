import { routerA } from "~/server/api/routers/groupA";
import { routerAAt } from "@/server/api/routers/groupA";
import { routerARel } from "../groupA";
import "node:fs";

export { flatB } from "../flatB";

export async function loadDyn() {
  const dyn = await import("../groupA/helper");
  return { dyn, routerA, routerAAt, routerARel };
}
