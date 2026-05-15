// Safe expression evaluator for template formulas.
// Supports: numbers, strings, identifiers (dot-paths), unary -, ! ,
// binary + - * / %, comparisons == != < <= > >= , logical && ||,
// ternary cond ? a : b, function calls (whitelisted), parentheses.
// NO eval, NO Function constructor, NO property access to host globals.

export type Value = number | string | boolean | null | undefined | unknown;

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "punct"; v: string };

const KEYWORDS = new Set(["true", "false", "null"]);
const FUNCTIONS: Record<string, (...args: Value[]) => Value> = {
  IF: (c, a, b) => (truthy(c) ? a : b),
  AND: (...xs) => xs.every(truthy),
  OR: (...xs) => xs.some(truthy),
  NOT: (x) => !truthy(x),
  MIN: (...xs) => Math.min(...xs.map(toNum)),
  MAX: (...xs) => Math.max(...xs.map(toNum)),
  ROUND: (x, d = 0) => {
    const p = Math.pow(10, toNum(d));
    return Math.round(toNum(x) * p) / p;
  },
  SUM: (...xs) => xs.flat().reduce((s: number, x) => s + toNum(x), 0),
  ABS: (x) => Math.abs(toNum(x)),
  COALESCE: (...xs) => xs.find((x) => x !== null && x !== undefined && x !== "") ?? "",
  CONCAT: (...xs) => xs.map((x) => (x === null || x === undefined ? "" : String(x))).join(""),
  UPPER: (x) => String(x ?? "").toUpperCase(),
  LOWER: (x) => String(x ?? "").toLowerCase(),
  LEN: (x) => (Array.isArray(x) ? x.length : String(x ?? "").length),
};

export function truthy(v: Value): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") return v.length > 0 && v.toLowerCase() !== "false";
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

function toNum(v: Value): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < src.length && (/[0-9.]/.test(src[j]))) j++;
      tokens.push({ t: "num", v: parseFloat(src.slice(i, j)) });
      i = j; continue;
    }
    if (c === '"' || c === "'") {
      const quote = c; let j = i + 1; let out = "";
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < src.length) { out += src[j + 1]; j += 2; }
        else { out += src[j]; j++; }
      }
      if (src[j] !== quote) throw new Error("Unterminated string in expression");
      tokens.push({ t: "str", v: out });
      i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      tokens.push({ t: "id", v: src.slice(i, j) });
      i = j; continue;
    }
    // Two-char operators
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      tokens.push({ t: "op", v: two }); i += 2; continue;
    }
    if ("+-*/%<>!?:".includes(c)) { tokens.push({ t: "op", v: c }); i++; continue; }
    if ("(),".includes(c)) { tokens.push({ t: "punct", v: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}" in expression`);
  }
  return tokens;
}

class Parser {
  pos = 0;
  constructor(public tokens: Token[]) {}
  peek(): Token | undefined { return this.tokens[this.pos]; }
  eat(): Token { return this.tokens[this.pos++]; }
  expect(t: string, v?: string): Token {
    const tok = this.eat();
    if (!tok || tok.t !== t || (v !== undefined && tok.v !== v))
      throw new Error(`Expected ${t}${v ? " " + v : ""}`);
    return tok;
  }

  parseExpr(): AST { return this.parseTernary(); }

  parseTernary(): AST {
    const cond = this.parseOr();
    if (this.peek()?.t === "op" && this.peek()?.v === "?") {
      this.eat();
      const a = this.parseExpr();
      this.expect("op", ":");
      const b = this.parseExpr();
      return { type: "ternary", cond, a, b };
    }
    return cond;
  }
  parseOr(): AST {
    let l = this.parseAnd();
    while (this.peek()?.v === "||") { this.eat(); l = { type: "bin", op: "||", l, r: this.parseAnd() }; }
    return l;
  }
  parseAnd(): AST {
    let l = this.parseEquality();
    while (this.peek()?.v === "&&") { this.eat(); l = { type: "bin", op: "&&", l, r: this.parseEquality() }; }
    return l;
  }
  parseEquality(): AST {
    let l = this.parseComparison();
    while (["==", "!="].includes(String(this.peek()?.v ?? ""))) {
      const op = String(this.eat().v); l = { type: "bin", op, l, r: this.parseComparison() };
    }
    return l;
  }
  parseComparison(): AST {
    let l = this.parseAdd();
    while (["<", "<=", ">", ">="].includes(String(this.peek()?.v ?? ""))) {
      const op = String(this.eat().v); l = { type: "bin", op, l, r: this.parseAdd() };
    }
    return l;
  }
  parseAdd(): AST {
    let l = this.parseMul();
    while (["+", "-"].includes(String(this.peek()?.v ?? ""))) {
      const op = String(this.eat().v); l = { type: "bin", op, l, r: this.parseMul() };
    }
    return l;
  }
  parseMul(): AST {
    let l = this.parseUnary();
    while (["*", "/", "%"].includes(String(this.peek()?.v ?? ""))) {
      const op = String(this.eat().v); l = { type: "bin", op, l, r: this.parseUnary() };
    }
    return l;
  }
  parseUnary(): AST {
    if (this.peek()?.v === "-" || this.peek()?.v === "!") {
      const op = String(this.eat().v); return { type: "unary", op, x: this.parseUnary() };
    }
    return this.parsePrimary();
  }
  parsePrimary(): AST {
    const tok = this.eat();
    if (!tok) throw new Error("Unexpected end of expression");
    if (tok.t === "num") return { type: "num", v: tok.v };
    if (tok.t === "str") return { type: "str", v: tok.v };
    if (tok.t === "punct" && tok.v === "(") {
      const e = this.parseExpr(); this.expect("punct", ")"); return e;
    }
    if (tok.t === "id") {
      if (KEYWORDS.has(tok.v)) {
        if (tok.v === "true") return { type: "bool", v: true };
        if (tok.v === "false") return { type: "bool", v: false };
        return { type: "nullv" };
      }
      // function call?
      if (this.peek()?.t === "punct" && this.peek()?.v === "(") {
        this.eat();
        const args: AST[] = [];
        if (!(this.peek()?.t === "punct" && this.peek()?.v === ")")) {
          args.push(this.parseExpr());
          while (this.peek()?.t === "punct" && this.peek()?.v === ",") {
            this.eat(); args.push(this.parseExpr());
          }
        }
        this.expect("punct", ")");
        return { type: "call", name: tok.v, args };
      }
      return { type: "id", path: tok.v.split(".") };
    }
    throw new Error("Unexpected token");
  }
}

export type AST =
  | { type: "num"; v: number }
  | { type: "str"; v: string }
  | { type: "bool"; v: boolean }
  | { type: "nullv" }
  | { type: "id"; path: string[] }
  | { type: "unary"; op: string; x: AST }
  | { type: "bin"; op: string; l: AST; r: AST }
  | { type: "ternary"; cond: AST; a: AST; b: AST }
  | { type: "call"; name: string; args: AST[] };

export function parseExpression(src: string): AST {
  const p = new Parser(tokenize(src));
  const ast = p.parseExpr();
  if (p.pos < p.tokens.length) throw new Error("Unexpected trailing tokens");
  return ast;
}

export function evalExpression(src: string, ctx: Record<string, Value>): Value {
  return evalAst(parseExpression(src), ctx);
}

function resolvePath(path: string[], ctx: Record<string, Value>): Value {
  let cur: Value = ctx;
  for (const seg of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    // Block prototype pollution
    if (seg === "__proto__" || seg === "constructor" || seg === "prototype") return undefined;
    cur = (cur as Record<string, Value>)[seg];
  }
  return cur;
}

function evalAst(n: AST, ctx: Record<string, Value>): Value {
  switch (n.type) {
    case "num": return n.v;
    case "str": return n.v;
    case "bool": return n.v;
    case "nullv": return null;
    case "id": return resolvePath(n.path, ctx);
    case "unary": {
      const x = evalAst(n.x, ctx);
      if (n.op === "-") return -toNum(x);
      if (n.op === "!") return !truthy(x);
      throw new Error(`Unknown unary op ${n.op}`);
    }
    case "bin": {
      // Short-circuit for && and ||
      if (n.op === "&&") return truthy(evalAst(n.l, ctx)) ? evalAst(n.r, ctx) : false;
      if (n.op === "||") {
        const lv = evalAst(n.l, ctx);
        return truthy(lv) ? lv : evalAst(n.r, ctx);
      }
      const l = evalAst(n.l, ctx); const r = evalAst(n.r, ctx);
      switch (n.op) {
        case "+":
          if (typeof l === "string" || typeof r === "string") return String(l ?? "") + String(r ?? "");
          return toNum(l) + toNum(r);
        case "-": return toNum(l) - toNum(r);
        case "*": return toNum(l) * toNum(r);
        case "/": { const d = toNum(r); return d === 0 ? 0 : toNum(l) / d; }
        case "%": { const d = toNum(r); return d === 0 ? 0 : toNum(l) % d; }
        case "==": return looseEq(l, r);
        case "!=": return !looseEq(l, r);
        case "<": return toNum(l) < toNum(r);
        case "<=": return toNum(l) <= toNum(r);
        case ">": return toNum(l) > toNum(r);
        case ">=": return toNum(l) >= toNum(r);
      }
      throw new Error(`Unknown op ${n.op}`);
    }
    case "ternary": return truthy(evalAst(n.cond, ctx)) ? evalAst(n.a, ctx) : evalAst(n.b, ctx);
    case "call": {
      const fn = FUNCTIONS[n.name.toUpperCase()];
      if (!fn) throw new Error(`Unknown function: ${n.name}`);
      return fn(...n.args.map((a) => evalAst(a, ctx)));
    }
  }
}

function looseEq(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === "number" || typeof b === "number") return toNum(a) === toNum(b);
  return String(a) === String(b);
}
