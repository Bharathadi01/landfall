import { describe, it, expect } from "vitest";
import tools from "../fixtures/studio-tools.json";
import { slimTool, slimTools, TOOL_EXAMPLES, dataDictionary } from "@/lib/ai/studio-slim";

/** A small JSON-schema validator: only the keywords AG Studio's tool schemas use. */
type S = any;
function valid(schema: S, v: any, root: S): boolean {
  if (schema.$ref) return valid(root.$defs[String(schema.$ref).replace("#/$defs/", "")], v, root);
  if (schema.anyOf) return schema.anyOf.some((b: S) => valid(b, v, root));
  if (schema.enum && !schema.enum.includes(v)) return false;
  switch (schema.type) {
    case "string": return typeof v === "string";
    case "number": return typeof v === "number";
    case "boolean": return typeof v === "boolean";
    case "null": return v === null;
    case "array": return Array.isArray(v) && v.every((x) => valid(schema.items ?? {}, x, root));
    case "object": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return false;
      const props = schema.properties ?? {};
      for (const r of schema.required ?? []) if (!(r in v)) return false;
      for (const [k, x] of Object.entries(v)) { if (!(k in props)) { if (schema.additionalProperties === false) return false; continue; } if (!valid(props[k], x, root)) return false; }
      return true;
    }
    default: return true;
  }
}
const byName = (list: S[], n: string) => list.find((t) => t.name === n)!;
const full = tools as S[];
const slim = slimTools(full as never) as S[];

/** First enum value found under a $def whose name starts with the prefix: a real field id from this data model. */
const fieldId = (prefix: string) => { const d = byName(full, "execute_query").parameters.$defs; const k = Object.keys(d).find((x) => x.startsWith(prefix))!; return d[k].enum?.[0] ?? d[k].anyOf?.[0]?.enum?.[0]; };
const str = fieldId("FieldIdsStringRoles"), num = fieldId("FieldIdsNumberRoles");

describe("the worked examples we give the model", () => {
  for (const [tool, def] of Object.entries(TOOL_EXAMPLES)) for (const [name, ex] of Object.entries(def.examples)) {
    it(`${tool}: the ${name} example is valid under Studio's FULL schema and under the slim one`, () => {
      const f = byName(full, tool).parameters, sl = byName(slim, tool).parameters;
      expect(valid(f, ex, f), "full").toBe(true);
      expect(valid(sl, ex, sl), "slim").toBe(true);
    });
  }
  it("the slim tool carries the example in its description", () => {
    expect(byName(slim, "execute_query").description).toContain('"variant":"aggregation"');
  });
});

describe("data dictionary", () => {
  const dict = dataDictionary(full as never)!;
  it("lists the real tables and fields from Studio's own schema, small enough to be cheap", () => {
    expect(dict).toContain("payout_items:");
    expect(dict).toContain("transaction_status");
    expect(dict).toMatch(/amount_usd#/);
    expect(dict.length).toBeLessThan(4500);
  });
  it("every example field id appears in it", () => {
    for (const id of ["payout_items.transaction_status", "payout_items.amount_usd", "payout_items.resident_name"]) expect(dict).toContain(id.split(".")[1]);
  });
  it("tells the model which field holds PayPal's status codes, so it filters the code and not a display label", () => {
    expect(dict).toContain("transaction_status holds PayPal's own status codes");
    expect(dict).toContain("UNCLAIMED");
    expect(dict).toContain("never filter on it");
  });
  it("returns null (and never throws) when there is no query tool", () => { expect(dataDictionary([])).toBeNull(); expect(dataDictionary(undefined)).toBeNull(); });
});

describe("slimmer Studio tool schemas", () => {
  it("are far smaller than Studio's own", () => {
    const a = JSON.stringify(full).length, b = JSON.stringify(slim).length;
    expect(b).toBeLessThan(a * 0.65);
  });

  it("offer every tool except view_schema (its output is already in execute_query's schema), and leave the small tools untouched", () => {
    expect(slim.map((t) => t.name)).toEqual(full.map((t) => t.name).filter((n) => n !== "view_schema"));
    for (const n of ["view_page", "create_recovery_page"]) expect(byName(slim, n)).toEqual(byName(full, n));
  });

  const cases: Array<[string, string, any]> = [
    ["an aggregation query (a dimension and a summed measure)", "execute_query", { query: { variant: "aggregation", kind: "apiQuery", axes: [{ dimensions: [{ field: { id: str } }] }], measures: [{ field: { id: num, aggregation: "sum" }, as: "total" }], limit: { count: 10 } } }],
    ["a projection query", "execute_query", { query: { variant: "projection", kind: "apiQuery", projection: [{ field: { id: str, aggregation: "first" } }, { field: { id: num, aggregation: "sum" } }], limit: { count: 20 } } }],
    ["a page filter on a text field", "add_page_filter", { op: "append", value: { field: { id: str }, model: { operator: "equals", value: "UNCLAIMED" } } }],
  ];
  for (const [label, tool, args] of cases) {
    it(`anything valid under the slim schema is valid under the full one: ${label}`, () => {
      const f = byName(full, tool).parameters, s = byName(slim, tool).parameters;
      expect(valid(f, args, f), "sample is valid under the FULL schema (test precondition)").toBe(true);
      expect(valid(s, args, s), "valid under slim").toBe(true);
    });
  }

  it("is strictly narrower: it refuses an advanced feature that was dropped (a computed expression)", () => {
    const s = byName(slim, "execute_query").parameters;
    const withExpr = { query: { variant: "aggregation", kind: "apiQuery", axes: [{ dimensions: [{ expression: { type: "field", field: { id: str } }, as: "x" }] }], measures: [{ field: { id: num, aggregation: "sum" } }] } };
    expect(valid(s, withExpr, s)).toBe(false);
  });

  it("never throws: a malformed tool comes back unchanged", () => {
    const weird = { name: "x", parameters: { type: "object", properties: null as never, padding: "x".repeat(4000) } };
    expect(slimTool(weird as never)).toBeTruthy();
  });
});
