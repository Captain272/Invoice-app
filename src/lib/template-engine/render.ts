// Template renderer. Supports:
//   {{var}}                  — simple placeholder (HTML-escaped by default)
//   {{{var}}}                — raw (no escape) — used for things like company_logo HTML
//   {{formula: expr}}        — evaluate expression, output result
//   {{#items}}...{{/items}}  — loop over array; inside, each item is the local scope
//                              plus access to outer scope via parent fields
//   {{if expr}}...{{else}}...{{/if}}  — conditional
//
// All expressions are evaluated by the safe expression engine (no eval).

import { evalExpression, truthy, type Value } from "./expression";

type Ctx = Record<string, Value>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stringify(v: Value): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Parse the template into a tree of nodes
type Node =
  | { type: "text"; v: string }
  | { type: "var"; expr: string; raw: boolean }
  | { type: "formula"; expr: string }
  | { type: "if"; cond: string; then: Node[]; else: Node[] }
  | { type: "loop"; name: string; body: Node[] };

function parseTemplate(src: string): Node[] {
  // Tokenize by scanning for {{...}}
  type Tok = { type: "text"; v: string } | { type: "tag"; v: string; raw?: boolean };
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const tripleOpen = src.indexOf("{{{", i);
    const doubleOpen = src.indexOf("{{", i);
    const next = doubleOpen === -1 ? -1 : doubleOpen;
    if (next === -1) { toks.push({ type: "text", v: src.slice(i) }); break; }
    if (next > i) toks.push({ type: "text", v: src.slice(i, next) });
    // Triple braces?
    if (tripleOpen === next) {
      const end = src.indexOf("}}}", next + 3);
      if (end === -1) throw new Error("Unclosed {{{ }}}");
      toks.push({ type: "tag", v: src.slice(next + 3, end).trim(), raw: true });
      i = end + 3;
    } else {
      const end = src.indexOf("}}", next + 2);
      if (end === -1) throw new Error("Unclosed {{ }}");
      toks.push({ type: "tag", v: src.slice(next + 2, end).trim() });
      i = end + 2;
    }
  }

  // Build tree
  let p = 0;
  function parseUntil(stop: (tag: string) => boolean): Node[] {
    const out: Node[] = [];
    while (p < toks.length) {
      const t = toks[p];
      if (t.type === "text") { out.push({ type: "text", v: t.v }); p++; continue; }
      const v = t.v;
      if (stop(v)) return out;
      if (v.startsWith("#")) {
        const name = v.slice(1).trim();
        p++;
        const body = parseUntil((tag) => tag === "/" + name);
        if (p >= toks.length) throw new Error(`Unterminated loop {{#${name}}}`);
        p++; // consume close
        out.push({ type: "loop", name, body });
      } else if (v.startsWith("if ")) {
        const cond = v.slice(3).trim();
        p++;
        const thenN = parseUntil((tag) => tag === "else" || tag === "/if");
        let elseN: Node[] = [];
        if (toks[p]?.type === "tag" && toks[p].v === "else") {
          p++;
          elseN = parseUntil((tag) => tag === "/if");
        }
        if (p >= toks.length) throw new Error("Unterminated {{if}}");
        p++; // consume {{/if}}
        out.push({ type: "if", cond, then: thenN, else: elseN });
      } else if (v.startsWith("formula:")) {
        out.push({ type: "formula", expr: v.slice("formula:".length).trim() });
        p++;
      } else {
        out.push({ type: "var", expr: v, raw: !!t.raw });
        p++;
      }
    }
    return out;
  }
  return parseUntil(() => false);
}

function renderNodes(nodes: Node[], ctx: Ctx, opts: { escape: boolean }): string {
  let out = "";
  for (const n of nodes) {
    switch (n.type) {
      case "text": out += n.v; break;
      case "var": {
        let v: Value;
        try { v = evalExpression(n.expr, ctx); } catch (e) {
          throw new Error(`Error in {{${n.expr}}}: ${(e as Error).message}`);
        }
        const s = stringify(v);
        out += opts.escape && !n.raw ? escapeHtml(s) : s;
        break;
      }
      case "formula": {
        let v: Value;
        try { v = evalExpression(n.expr, ctx); } catch (e) {
          throw new Error(`Error in formula {{${n.expr}}}: ${(e as Error).message}`);
        }
        const s = stringify(v);
        out += opts.escape ? escapeHtml(s) : s;
        break;
      }
      case "if": {
        let cond: Value;
        try { cond = evalExpression(n.cond, ctx); } catch (e) {
          throw new Error(`Error in {{if ${n.cond}}}: ${(e as Error).message}`);
        }
        out += renderNodes(truthy(cond) ? n.then : n.else, ctx, opts);
        break;
      }
      case "loop": {
        const arr = ctx[n.name];
        if (!Array.isArray(arr)) break;
        for (let idx = 0; idx < arr.length; idx++) {
          const item = arr[idx];
          const child: Ctx = { ...(typeof item === "object" && item !== null ? (item as Ctx) : { value: item as Value }) };
          // Inherit parent scope (parent values), don't overwrite
          for (const k of Object.keys(ctx)) if (!(k in child)) child[k] = ctx[k];
          child.index = idx;
          child.index1 = idx + 1;
          child.is_first = idx === 0;
          child.is_last = idx === arr.length - 1;
          out += renderNodes(n.body, child, opts);
        }
        break;
      }
    }
  }
  return out;
}

export function renderTemplate(
  template: string,
  data: Ctx,
  options: { format: "HTML" | "XML" } = { format: "HTML" }
): string {
  const tree = parseTemplate(template);
  return renderNodes(tree, data, { escape: true });
  // Note: XML uses the same XML-safe escapes as HTML for &, <, >, " — sufficient for both.
}

// Special: render filename formulas (no escaping, sanitize for filesystem)
export function renderFileName(formula: string, data: Ctx): string {
  const tree = parseTemplate(formula);
  const raw = renderNodes(tree, data, { escape: false });
  // Sanitize: replace anything not alnum/_/-/. with _
  return raw.replace(/[^A-Za-z0-9_.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
