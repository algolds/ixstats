import { routerA } from "~/server/api/routers/groupA";
import { flatB } from "./flatB";
import "~/server/api/routers/groupB";

export const flatA = { routerA, flatB };
