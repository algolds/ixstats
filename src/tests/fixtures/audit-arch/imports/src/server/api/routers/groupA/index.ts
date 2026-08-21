import { groupAHelper } from "./helper";
import { groupASubHelper } from "./sub/helper";
import { util } from "~/server/shared/util";

// comment containing import { evil } from "~/server/api/routers/groupB"
const notAnImport = 'import { fake } from "~/server/api/routers/groupB"';

export const routerA = { a: 1, helper: groupAHelper, sub: groupASubHelper, util, notAnImport };
