interface TradeInputs {
  nominalGDP?: number | null;
  exportsGDPPercent?: number | null;
  importsGDPPercent?: number | null;
}

/** Recorded exports and imports in currency (percent of GDP times GDP); null where unrecorded. */
export function tradeFigures(core: TradeInputs | null | undefined) {
  const gdp = core?.nominalGDP ?? 0;
  const of = (pct: number | null | undefined) =>
    gdp > 0 && pct != null ? (gdp * pct) / 100 : null;
  const exports = of(core?.exportsGDPPercent);
  const imports = of(core?.importsGDPPercent);
  return {
    exports,
    imports,
    balance: exports != null && imports != null ? exports - imports : null,
  };
}
