/**
 * A literal-only reader for data files written as JavaScript (`const nations = { … }; export default nations;`).
 * Fetched source files are untrusted: they are never evaluated or imported. This finds one top-level binding
 * (`const|let|var <name> =`, optionally `export`ed) and reads the literal after `=`, accepting only object and
 * array literals, strings, numbers, true, false and null, with comments, trailing commas and identifier or
 * quoted keys. Anything else (a call, a reference, a template literal, a spread, a getter or method, a computed
 * key) is refused with the line it was found on. Objects are created without a prototype, so a `__proto__` key
 * is an ordinary own key and cannot reach Object.prototype. Text after the literal is never read.
 */

export type LiteralValue =
  | string
  | number
  | boolean
  | null
  | LiteralValue[]
  | { [key: string]: LiteralValue };

export class LiteralParseError extends Error {
  constructor(
    message: string,
    public readonly line: number
  ) {
    super(`${message} (line ${line})`);
    this.name = "LiteralParseError";
  }
}

/** Deeper than any data file needs; a hostile file of nested brackets is refused instead of overflowing the stack. */
export const MAX_LITERAL_DEPTH = 64;
/** Values (strings, numbers, objects, arrays…) read before giving up. */
export const MAX_LITERAL_NODES = 2_000_000;

const ID_START = /[A-Za-z_$\p{L}]/u;
const ID_PART = /[A-Za-z0-9_$\p{L}\p{Mn}\p{Mc}\p{Nd}]/u;
const DECLARATION = new Set(["const", "let", "var"]);

class Reader {
  pos = 0;
  nodes = 0;
  constructor(readonly src: string) {}

  line(at = this.pos): number {
    let n = 1;
    for (let i = 0; i < at && i < this.src.length; i++) if (this.src.charCodeAt(i) === 10) n++;
    return n;
  }

  fail(message: string, at = this.pos): never {
    throw new LiteralParseError(message, this.line(at));
  }

  peek(offset = 0): string {
    return this.src[this.pos + offset] ?? "";
  }

  /** Skip whitespace and comments. */
  skip(): void {
    for (;;) {
      const c = this.peek();
      if (c === "") return;
      if (/\s/.test(c)) {
        this.pos++;
      } else if (c === "/" && this.peek(1) === "/") {
        const end = this.src.indexOf("\n", this.pos);
        this.pos = end === -1 ? this.src.length : end + 1;
      } else if (c === "/" && this.peek(1) === "*") {
        const end = this.src.indexOf("*/", this.pos + 2);
        if (end === -1) this.fail("Unterminated comment");
        this.pos = end + 2;
      } else {
        return;
      }
    }
  }

  identifier(): string | null {
    const start = this.pos;
    if (!ID_START.test(this.peek())) return null;
    while (this.pos < this.src.length && ID_PART.test(this.peek())) this.pos++;
    return this.src.slice(start, this.pos);
  }

  string(): string {
    const quote = this.peek();
    const start = this.pos;
    this.pos++;
    let out = "";
    for (;;) {
      const c = this.peek();
      if (c === "") this.fail("Unterminated string", start);
      if (c === "\n" || c === "\r") this.fail("Line break inside a string", start);
      this.pos++;
      if (c === quote) return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      out += this.escape();
    }
  }

  escape(): string {
    const c = this.peek();
    this.pos++;
    const simple: Record<string, string> = {
      n: "\n",
      t: "\t",
      r: "\r",
      b: "\b",
      f: "\f",
      v: "\v",
      "0": "\0",
      "'": "'",
      '"': '"',
      "\\": "\\",
      "/": "/",
    };
    if (c in simple && !(c === "0" && /[0-9]/.test(this.peek()))) return simple[c]!;
    if (c === "x") return this.hex(2);
    if (c === "u") {
      if (this.peek() !== "{") return this.hex(4);
      const end = this.src.indexOf("}", this.pos);
      if (end === -1 || end - this.pos > 7) this.fail("Bad \\u{} escape");
      const code = Number.parseInt(this.src.slice(this.pos + 1, end), 16);
      if (!Number.isFinite(code) || code > 0x10ffff) this.fail("Bad \\u{} escape");
      this.pos = end + 1;
      return String.fromCodePoint(code);
    }
    if (c === "\n") return "";
    return this.fail("Unsupported escape in a string");
  }

  hex(digits: number): string {
    const raw = this.src.slice(this.pos, this.pos + digits);
    if (!new RegExp(`^[0-9a-fA-F]{${digits}}$`).test(raw)) this.fail("Bad hex escape");
    this.pos += digits;
    return String.fromCharCode(Number.parseInt(raw, 16));
  }

  number(): number {
    const match = /^-?(?:0|[1-9][0-9_]*)(?:\.[0-9_]+)?(?:[eE][+-]?[0-9]+)?|^-?\.[0-9]+/.exec(
      this.src.slice(this.pos, this.pos + 64)
    );
    if (!match) this.fail("Bad number");
    this.pos += match[0].length;
    if (ID_PART.test(this.peek())) this.fail("Bad number");
    const value = Number(match[0].replace(/_/g, ""));
    if (!Number.isFinite(value)) this.fail("Bad number");
    return value;
  }

  value(depth: number): LiteralValue {
    if (depth > MAX_LITERAL_DEPTH) this.fail("Literal nested too deeply");
    if (++this.nodes > MAX_LITERAL_NODES) this.fail("Literal too large");
    this.skip();
    const c = this.peek();
    if (c === "{") return this.object(depth);
    if (c === "[") return this.array(depth);
    if (c === '"' || c === "'") return this.string();
    if (c === "-" || c === "." || /[0-9]/.test(c)) return this.number();
    if (c === "`") this.fail("Template literals are not allowed");
    const start = this.pos;
    const word = this.identifier();
    if (word === "true") return true;
    if (word === "false") return false;
    if (word === "null") return null;
    if (word) return this.fail(`Only literals are allowed, found "${word}"`, start);
    return this.fail(c ? `Unexpected "${c}"` : "Unexpected end of file");
  }

  key(): string {
    this.skip();
    const c = this.peek();
    if (c === '"' || c === "'") return this.string();
    if (/[0-9]/.test(c)) return String(this.number());
    if (c === "[") this.fail("Computed keys are not allowed");
    if (c === ".") this.fail("Spread is not allowed");
    const word = this.identifier();
    if (!word) this.fail(c ? `Unexpected "${c}" in an object` : "Unexpected end of file");
    return word;
  }

  object(depth: number): { [key: string]: LiteralValue } {
    this.pos++;
    const out = Object.create(null) as { [key: string]: LiteralValue };
    for (;;) {
      this.skip();
      if (this.peek() === "}") {
        this.pos++;
        return out;
      }
      const key = this.key();
      this.skip();
      if (this.peek() !== ":")
        this.fail(`Expected ":" after "${key}" (shorthand, getters and methods are not allowed)`);
      this.pos++;
      out[key] = this.value(depth + 1);
      this.skip();
      if (this.peek() === ",") this.pos++;
      else if (this.peek() !== "}") this.fail('Expected "," or "}"');
    }
  }

  array(depth: number): LiteralValue[] {
    this.pos++;
    const out: LiteralValue[] = [];
    for (;;) {
      this.skip();
      if (this.peek() === "]") {
        this.pos++;
        return out;
      }
      if (this.peek() === ",") this.fail("Holes in arrays are not allowed");
      if (this.peek() === "." && this.peek(1) === ".") this.fail("Spread is not allowed");
      out.push(this.value(depth + 1));
      this.skip();
      if (this.peek() === ",") this.pos++;
      else if (this.peek() !== "]") this.fail('Expected "," or "]"');
    }
  }

  /** Skip a string, template literal or comment at the cursor while scanning for the binding. */
  skipOpaque(): boolean {
    const c = this.peek();
    if (c === "/" && (this.peek(1) === "/" || this.peek(1) === "*")) {
      this.skip();
      return true;
    }
    if (c === '"' || c === "'") {
      this.string();
      return true;
    }
    if (c === "`") {
      const start = this.pos;
      this.pos++;
      while (this.peek() !== "`") {
        if (this.peek() === "") this.fail("Unterminated template literal", start);
        this.pos += this.peek() === "\\" ? 2 : 1;
      }
      this.pos++;
      return true;
    }
    return false;
  }

  /** Move the cursor to the start of the literal bound to `binding` at the top level. */
  seekBinding(binding: string): void {
    let depth = 0;
    while (this.pos < this.src.length) {
      if (this.skipOpaque()) continue;
      const c = this.peek();
      if (c === "{" || c === "[" || c === "(") depth++;
      if (c === "}" || c === "]" || c === ")") depth--;
      if (!ID_START.test(c)) {
        this.pos++;
        continue;
      }
      const word = this.identifier()!;
      if (depth === 0 && DECLARATION.has(word)) {
        const mark = this.pos;
        this.skip();
        if (this.identifier() === binding) {
          this.skip();
          if (this.peek() === "=" && this.peek(1) !== "=") {
            this.pos++;
            return;
          }
        }
        this.pos = mark;
      }
    }
    this.fail(`No top-level "const ${binding} = …" found`, this.src.length);
  }
}

/**
 * Read the literal bound to `binding` (`const <binding> = <literal>`) in a JavaScript data file, without
 * evaluating anything. Throws LiteralParseError on anything that is not a plain literal.
 */
export function readBoundLiteral(source: string, binding: string): LiteralValue {
  const reader = new Reader(source);
  reader.seekBinding(binding);
  const value = reader.value(0);
  reader.skip();
  const next = reader.peek();
  if (next !== "" && next !== ";" && next !== "\n" && !/[A-Za-z_$]/.test(next))
    reader.fail(`Unexpected "${next}" after the literal`);
  return value;
}

/** Read a whole input that is just one literal (tests, pasted data). */
export function readLiteral(source: string): LiteralValue {
  const reader = new Reader(source);
  const value = reader.value(0);
  reader.skip();
  if (reader.peek() !== "") reader.fail(`Unexpected "${reader.peek()}" after the literal`);
  return value;
}

export function isLiteralObject(value: LiteralValue | undefined): value is { [key: string]: LiteralValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
