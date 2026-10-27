/**
 * Allowance for wall-clock budgets in the linear-time (regex DoS) gates.
 *
 * The budgets were measured on a fast workstation. CI runners and containers run the same linear code
 * up to about twice as slowly (a 2.1 GHz Xeon took 3.0 to 4.4 s for a case measured at 2.3 s), so a
 * fixed budget fails there without any change in complexity. A quadratic pass is still caught: at the
 * gates' sizes it is 10 to 100 times over budget, far past this allowance.
 *
 * `TIMING_BUDGET_SCALE` overrides the default of 2 and is clamped to 1..4.
 */
const requested = Number(process.env.TIMING_BUDGET_SCALE ?? 2);

export const TIMING_BUDGET_SCALE = Math.min(
  4,
  Math.max(1, Number.isFinite(requested) ? requested : 2)
);
