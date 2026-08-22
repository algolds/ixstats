/**
 * parser-functions.ts — WikiOS Native JavaScript ParserFunctions Evaluator
 *
 * Replaces MediaWiki's PHP Extension:ParserFunctions with fast, safe TypeScript
 * evaluation for #if, #ifeq, #switch, #expr, and #time.
 */

export class ParserFunctionEvaluator {
  /**
   * #if: testString | valueIfTrue | valueIfFalse
   */
  static evalIf(testString: string, valueIfTrue: string, valueIfFalse = ""): string {
    return testString.trim() ? valueIfTrue : valueIfFalse;
  }

  /**
   * #ifeq: string1 | string2 | valueIfEqual | valueIfNotEqual
   */
  static evalIfEq(
    string1: string,
    string2: string,
    valueIfEqual: string,
    valueIfNotEqual = ""
  ): string {
    return string1.trim() === string2.trim() ? valueIfEqual : valueIfNotEqual;
  }

  /**
   * #switch: test | case1 = val1 | case2 = val2 | #default = defaultVal
   */
  static evalSwitch(
    testVal: string,
    cases: Record<string, string>,
    defaultVal = ""
  ): string {
    const key = testVal.trim();
    if (cases[key] !== undefined) return cases[key];
    return cases["#default"] ?? defaultVal;
  }

  /**
   * #expr: mathematical expression evaluation (safe arithmetic parser)
   */
  static evalExpr(mathExpr: string): string {
    try {
      // Clean string to allow only numbers, parentheses, and arithmetic operators
      const sanitized = mathExpr.replace(/[^0-9+\-*/().\s^%]/g, "");
      if (!sanitized.trim()) return "0";

      // Basic safe calculation
      const fn = new Function(`return (${sanitized.replace(/\^/g, "**")});`);
      const result = fn();
      return typeof result === "number" && !isNaN(result) ? String(result) : "0";
    } catch {
      return "0";
    }
  }

  /**
   * #time: format date string
   */
  static evalTime(format: string, dateStr?: string): string {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return dateStr || "";

    const Y = String(d.getUTCFullYear());
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(d.getUTCDate()).padStart(2, "0");

    return format
      .replace(/Y/g, Y)
      .replace(/m/g, m)
      .replace(/d/g, dStr);
  }
}
