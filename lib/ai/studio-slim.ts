/**
 * Slimmer tool schemas for the Studio agent's model calls.
 *
 * AG Studio sends the model very large JSON schemas (execute_query and add_page_filter are ~22,000 characters each, ~45,000 for all
 * five tools). On Groq's free tier that is ~6,400 input tokens per call, and a question needs two or more calls against a budget of
 * 8,000 tokens per minute per model, so the second call was always rate limited and the assistant fell back to the offline analyst.
 *
 * This only ever makes a schema STRICTER (it drops optional properties, advanced alternatives, and rarely-needed operators). Anything
 * the model can then produce is still valid under Studio's full schema, which Studio itself validates when it runs the tool. Nothing
 * here widens what a tool can do, and the tools themselves (read-only analysis and dashboard edits) are unchanged.
 */

/** Optional / advanced properties the assistant rarely needs. Dropping an optional property cannot make a call invalid. */
const DROP_PROPS = new Set(["members", "topN", "bucketThreshold", "emptyValues", "showEmpty", "fillPolicy", "window", "filterAggregated", "distinct", "orderBy", "view", "options", "joins"]);

/** Filter operators kept for page filters; the rest (regex-like, relative-date, rank, etc.) are dropped. */
const KEEP_OPERATORS = new Set(["equals", "notEqual", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "contains", "notContains", "startsWith", "isBlank", "isNotBlank", "isNull", "isNotNull", "isTrue", "isFalse", "inRange", "in", "notIn"]);

type J = any;

/** Alternatives that need computed expressions, predicates or nested AND/OR groups: advanced, and each drags in a large sub-schema. */
const isAdvancedBranch = (b: J) => !!b && typeof b === "object" && !!b.properties && ("expression" in b.properties || "predicate" in b.properties || "conditions" in b.properties);
/** Operators dropped from filters (pattern matching, relative dates). */
const DROP_OPERATORS = new Set(["like", "notLike", "inRelativeRange"]);
const operatorOf = (b: J): string | null => {
  const e = b?.properties?.operator?.enum;
  return Array.isArray(e) && e.length === 1 ? String(e[0]) : null;
};

function prune(node: J): J {
  if (Array.isArray(node)) return node.map(prune);
  if (!node || typeof node !== "object") return node;
  const out: J = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "enum" || k === "required") { out[k] = v; continue; }
    if (k === "anyOf" && Array.isArray(v)) {
      let branches = v.filter((b) => !isAdvancedBranch(b) && !DROP_OPERATORS.has(String(b?.properties?.operator?.enum?.[0] ?? "")));
      // keep only the common filter operators when every branch is an operator branch
      const ops = branches.map(operatorOf);
      if (branches.length > 3 && ops.every((o) => o !== null)) { const kept = branches.filter((_, i) => KEEP_OPERATORS.has(ops[i] as string)); if (kept.length) branches = kept; }
      branches = branches.map(prune);
      if (branches.length === 0) branches = v.map(prune); // never leave an empty alternative
      if (branches.length === 1) { Object.assign(out, branches[0]); continue; }
      out[k] = branches;
      continue;
    }
    if (k === "properties" && v && typeof v === "object") {
      const props: J = {};
      for (const [pk, pv] of Object.entries(v as J)) if (!DROP_PROPS.has(pk)) props[pk] = prune(pv);
      out[k] = props;
      continue;
    }
    out[k] = prune(v);
  }
  if (out.properties && Array.isArray(out.required)) out.required = out.required.filter((r: string) => r in out.properties);
  return out;
}

/** Remove $defs nothing refers to any more. */
function dropUnusedDefs(schema: J): J {
  if (!schema?.$defs) return schema;
  const defs: J = schema.$defs;
  const used = new Set<string>();
  const walk = (n: J) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    for (const [k, v] of Object.entries(n)) {
      if (k === "$ref" && typeof v === "string" && v.startsWith("#/$defs/")) {
        const name = v.slice("#/$defs/".length);
        if (!used.has(name) && defs[name]) { used.add(name); walk(defs[name]); }
      } else if (k !== "$defs") walk(v);
    }
  };
  walk({ ...schema, $defs: undefined });
  const kept: J = {};
  for (const name of Object.keys(defs)) if (used.has(name)) kept[name] = defs[name];
  return { ...schema, $defs: kept };
}

/**
 * The models kept inventing a simplified call ({mode, fields, filters, sort, limit}) from Studio's prose description and were rejected by
 * Groq's own schema check, on both gpt-oss models. A worked example of the exact shape fixes that. The field ids are real ones from the
 * Studio data model (tests check every example against Studio's full schema, so they cannot drift).
 */
export const TOOL_EXAMPLES: Record<string, { description: string; examples: Record<string, unknown> }> = {
  execute_query: {
    description:
      "Run a read-only query on the data. The arguments MUST be an object with ONE key, \"query\" (never top-level mode/fields/filters/sort/limit). Use variant \"aggregation\" for grouped totals (axes + measures) or variant \"projection\" for raw rows (projection). In projection every projected field needs an aggregation (\"first\" for text, \"sum\" for numbers) and an \"as\" name (without it the column comes back empty). Filters go inside \"query\" and name the field by id only, with no aggregation.",
    examples: {
      aggregation: { query: { variant: "aggregation", kind: "apiQuery", axes: [{ dimensions: [{ field: { id: "payout_items.transaction_status" } }] }], measures: [{ field: { id: "payout_items.amount_usd", aggregation: "sum" }, as: "total_usd" }], limit: { count: 20 } } },
      projection: { query: { variant: "projection", kind: "apiQuery", projection: [{ field: { id: "payout_items.resident_name", aggregation: "first" }, as: "resident" }, { field: { id: "payout_items.amount_usd", aggregation: "sum" }, as: "amount_usd" }], filter: { field: { id: "payout_items.transaction_status" }, operator: "equals", value: "UNCLAIMED" }, limit: { count: 20 } } },
    },
  },
  add_page_filter: {
    description: "Add a filter to the current page. Arguments: op \"append\" and a value holding the field and a model with an operator and value.",
    examples: { text: { op: "append", value: { field: { id: "payout_items.transaction_status" }, model: { operator: "equals", value: "UNCLAIMED" } } } },
  },
};

const describe = (name: string): string | null => {
  const t = TOOL_EXAMPLES[name];
  if (!t) return null;
  return `${t.description} Examples: ${Object.values(t.examples).map((e) => JSON.stringify(e)).join(" ")}`;
};

export interface ToolLike { name: string; description?: string; parameters?: Record<string, unknown> | J }

/** Slim one tool. Never throws: on any surprise the original tool is returned unchanged. */
export function slimTool<T extends ToolLike>(tool: T): T {
  try {
    if (!tool?.parameters || JSON.stringify(tool.parameters).length < 3000) return tool; // small tools are already fine
    const description = describe(tool.name) ?? (typeof tool.description === "string" && tool.description.length > 260 ? tool.description.slice(0, 257).replace(/\s+\S*$/, "") + "…" : tool.description);
    return { ...tool, description, parameters: dropUnusedDefs(prune(tool.parameters)) };
  } catch {
    return tool;
  }
}

/** Tools the model is never offered. view_schema returns an ~11,600-character listing of fields that execute_query's own schema already enumerates,
 *  so offering it only cost an extra model call and ~3,000 tokens per question. (Studio itself still has the tool.) */
const NOT_OFFERED = new Set(["view_schema"]);

export const slimTools = <T extends ToolLike>(tools: T[] | undefined): T[] | undefined => tools?.filter((t) => !NOT_OFFERED.has(t.name)).map(slimTool);

/**
 * A compact "data dictionary" for the model, built from the field-id enums inside execute_query's own schema (so it cannot drift from
 * what Studio will accept). Without it the model, no longer shown the 11,600-character view_schema dump, invents field names.
 * "#" marks number fields, "@" date fields; everything else is text.
 */
export function dataDictionary(tools: ToolLike[] | undefined): string | null {
  try {
    const defs = tools?.find((t) => t.name === "execute_query")?.parameters?.$defs as J;
    if (!defs) return null;
    const byTable = new Map<string, Set<string>>();
    for (const [name, def] of Object.entries<J>(defs)) {
      if (!name.startsWith("FieldIds") || !Array.isArray(def?.enum)) continue;
      const tag = name.includes("Number") ? "#" : name.includes("Date") ? "@" : "";
      for (const id of def.enum as string[]) {
        const [table, ...rest] = String(id).split(".");
        if (!rest.length) continue;
        const set = byTable.get(table) ?? new Set<string>();
        set.add(rest.join(".") + tag);
        byTable.set(table, set);
      }
    }
    if (!byTable.size) return null;
    const lines = [...byTable.entries()].map(([t, f]) => `${t}: ${[...f].join(", ")}`);
    // Value hints for the fields people ask about most. Without them a model filters a human label ("Unclaimed by Resident") for a
    // status code ("UNCLAIMED") and wrongly answers "none".
    const hints =
      byTable.has("payout_items")
        ? "\nVALUES. payout_items.transaction_status holds PayPal's own status codes, exactly: SUCCESS, UNCLAIMED, PENDING, ONHOLD, FAILED, RETURNED. " +
          "To find payments by status, filter transaction_status with one of those codes. payout_items.status_label is only a display label; never filter on it."
        : "";
    return `DATA DICTIONARY. Use ONLY these ids, written table.field (for example payout_items.transaction_status). # = number, @ = date, otherwise text.\n${lines.join("\n")}${hints}`;
  } catch {
    return null;
  }
}
