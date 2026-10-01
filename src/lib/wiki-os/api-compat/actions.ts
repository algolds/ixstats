/**
 * actions.ts — the `action=` values api.php serves (plan 410), and whether each needs POST.
 */

import { runCompare } from "./modules/compare";
import { runEdit } from "./modules/edit";
import { runLegacyTokens } from "./modules/legacy-tokens";
import { runLogin, runLogout } from "./modules/login";
import { runOpenSearch } from "./modules/opensearch";
import { runDelete, runMove, runProtect, runRollback, runUndelete } from "./modules/page-ops";
import { runParamInfo } from "./modules/paraminfo";
import { runParse } from "./modules/parse";
import { runPurge } from "./modules/purge";
import { runUpload } from "./modules/upload";
import { runQuery } from "./modules/query";
import { buildRegistry } from "./registry";
import type { ApiContext, ApiResult } from "./types";

export interface ActionSpec {
  run: (rc: ApiContext) => ApiResult | Promise<ApiResult>;
  /** The module changes state, so it needs POST. */
  post: boolean;
}

const ACTIONS_WITHOUT_PARAMINFO: Readonly<Record<string, ActionSpec>> = {
  query: { run: runQuery, post: false },
  parse: { run: runParse, post: false },
  opensearch: { run: runOpenSearch, post: false },
  compare: { run: runCompare, post: false },
  tokens: { run: runLegacyTokens, post: false },
  login: { run: runLogin, post: true },
  logout: { run: runLogout, post: true },
  edit: { run: runEdit, post: true },
  move: { run: runMove, post: true },
  delete: { run: runDelete, post: true },
  undelete: { run: runUndelete, post: true },
  protect: { run: runProtect, post: true },
  rollback: { run: runRollback, post: true },
  purge: { run: runPurge, post: true },
  upload: { run: runUpload, post: true },
};

/** Every action, `paraminfo` (which describes them all, itself included) among them. */
export const ACTIONS: Readonly<Record<string, ActionSpec>> = {
  ...ACTIONS_WITHOUT_PARAMINFO,
  paraminfo: {
    run: (rc) => runParamInfo(rc, () => buildRegistry(ACTIONS), Object.keys(ACTIONS)),
    post: false,
  },
};

export const ACTION_NAMES: readonly string[] = Object.keys(ACTIONS);
