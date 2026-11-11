import type { Role, Session } from "./session";

/**
 * ONE table that says who may call what. Used by middleware (enforcement), by route-level guards, and by a test
 * that walks every file in app/api so a new route cannot ship without an explicit rule (default = deny).
 *
 *  public            anyone (the route itself validates input and rate-limits)
 *  webhook           PayPal calls it; authenticity = PayPal signature verified in the route
 *  cron              scheduler calls it with CRON_SECRET (verified in the route); staff sessions also allowed
 *  operator          any signed-in console user: coordinator, finance or viewer (read + safe actions)
 *  staff             coordinator or finance (anything that writes, spends PayPal calls, or proposes money movement)
 *  finance           finance only
 *  resident          a resident session (their own household only)
 *  resident-operator a resident session for their own household, or any operator
 */
export type Access = "public" | "webhook" | "cron" | "operator" | "staff" | "finance" | "resident" | "resident-operator";

export interface Rule {
  /** matched against the pathname */
  pattern: RegExp;
  /** omitted = every method */
  methods?: string[];
  access: Access;
  note: string;
}

export const API_RULES: Rule[] = [
  // --- public weather / alerts (read-only, no personal data) ---
  { pattern: /^\/api\/alerts$/, methods: ["GET"], access: "public", note: "official NWS alerts" },
  { pattern: /^\/api\/sentinel\/(live|imagery|forecast-grid)$/, methods: ["GET"], access: "public", note: "public weather feeds" },
  // --- auth + demo entry points ---
  { pattern: /^\/api\/auth\/session$/, access: "public", note: "persona sign-in / sign-out" },
  { pattern: /^\/api\/auth\/paypal\/(start|callback)$/, access: "public", note: "PayPal identity linking (OAuth redirect)" },
  { pattern: /^\/api\/auth\/passkey\/(register-options|register-verify)$/, methods: ["POST"], access: "staff", note: "register a passkey for the signed-in persona" },
  { pattern: /^\/api\/judge\//, access: "public", note: "judge test-card helpers (gated by JUDGE_MODE_ENABLED in the route)" },
  { pattern: /^\/api\/resident\/session$/, access: "public", note: "resident code exchange" },
  { pattern: /^\/api\/resident\//, access: "resident", note: "resident-only actions" },
  // --- donors (public by design; PayPal-hosted approval; rate-limited) ---
  { pattern: /^\/api\/donations\/(orders|capture)$/, access: "public", note: "donation checkout" },
  { pattern: /^\/api\/subscriptions\/(create|cancel)$/, access: "public", note: "sustainer subscriptions" },
  { pattern: /^\/api\/pledges\/(create|revoke|setup-token)$/, access: "public", note: "storm pledges" },
  // --- PayPal + cron ---
  { pattern: /^\/api\/paypal\/webhook$/, access: "webhook", note: "signature verified by PayPal's verify API" },
  { pattern: /^\/api\/alerts\/poll$/, access: "cron", note: "NWS poll (cron secret or staff)" },
  { pattern: /^\/api\/payouts\/refresh-due$/, access: "cron", note: "cron refresh of in-flight batches" },
  // --- resident intake (public forms; validated + rate-limited) ---
  { pattern: /^\/api\/recipients\/enroll$/, methods: ["POST"], access: "public", note: "new-household enrolment form" },
  { pattern: /^\/api\/recipients\/verify-email$/, methods: ["POST"], access: "public", note: "email token verification" },
  { pattern: /^\/api\/recipients\/complaints$/, methods: ["POST"], access: "public", note: "complaint intake form" },
  { pattern: /^\/api\/recipients\/complaints$/, methods: ["GET"], access: "resident-operator", note: "own complaints (resident) or the masked full list (operators); the route enforces which" },
  { pattern: /^\/api\/recipients\/case$/, methods: ["GET"], access: "resident-operator", note: "case status — own household only" },
  { pattern: /^\/api\/recipients\/access-report$/, methods: ["POST"], access: "resident-operator", note: "resident reports receipt / barrier" },
  { pattern: /^\/api\/recipients\/access-report$/, methods: ["GET"], access: "operator", note: "reports list for coordinators" },
  { pattern: /^\/api\/recipients\/(appeal|reconfirm)$/, methods: ["POST"], access: "resident-operator", note: "appeal / reconfirm" },
  { pattern: /^\/api\/recipients\/appeal$/, methods: ["GET"], access: "operator", note: "appeals queue" },
  { pattern: /^\/api\/recipients$/, access: "operator", note: "household directory (masked PII)" },
  // --- console data ---
  { pattern: /^\/api\/cases(\/|$)/, methods: ["GET"], access: "operator", note: "case list / detail" },
  { pattern: /^\/api\/cases\/[^/]+\/investigate$/, methods: ["POST"], access: "operator", note: "AI case investigation (read-only)" },
  { pattern: /^\/api\/proposals(\/|$)/, methods: ["GET"], access: "operator", note: "proposal lookup" },
  { pattern: /^\/api\/proposals$/, methods: ["POST"], access: "staff", note: "propose a payment or recovery action" },
  { pattern: /^\/api\/proposals\/[^/]+\/approve$/, methods: ["POST"], access: "staff", note: "approve (role rules enforced in the route)" },
  { pattern: /^\/api\/proposals\/[^/]+\/approve\/options$/, methods: ["POST"], access: "staff", note: "start a passkey approval (challenge bound to the payload hash)" },
  { pattern: /^\/api\/payouts$/, methods: ["GET"], access: "operator", note: "recorded payout batches" },
  { pattern: /^\/api\/payouts\/refresh$/, access: "staff", note: "read-only GET to PayPal + store" },
  { pattern: /^\/api\/treasury\/(reconcile|waterfall)$/, access: "operator", note: "treasury views (rate-limited)" },
  { pattern: /^\/api\/watch-officer$/, access: "operator", note: "AI briefing (rate-limited)" },
  { pattern: /^\/api\/studio-llm$/, access: "operator", note: "Studio agent model gateway" },
  { pattern: /^\/api\/grid\/ask$/, access: "operator", note: "ask-the-grid" },
  { pattern: /^\/api\/rehearsal$/, access: "operator", note: "storm rehearsal" },
  { pattern: /^\/api\/workflow\/(golden|manifest)$/, access: "operator", note: "guided rehearsal (simulated PayPal)" },
  { pattern: /^\/api\/alerts\/(replay|exposure)$/, access: "staff", note: "writes / reads household exposure" },
  { pattern: /^\/api\/export\//, access: "staff", note: "accountability exports" },
  { pattern: /^\/api\/validate$/, methods: ["POST", "GET"], access: "public", note: "stakeholder feedback intake (consent-gated) and an aggregate count" },
];

export function resolveApiRule(pathname: string, method: string): Rule | null {
  const m = method.toUpperCase();
  for (const r of API_RULES) {
    if (r.pattern.test(pathname) && (!r.methods || r.methods.includes(m))) return r;
  }
  return null;
}

/** Page paths that need a console (operator) session. Everything else is public. */
export const CONSOLE_PAGE = /^\/console(\/|$)/;

const STAFF: Role[] = ["coordinator", "finance"];
const OPERATORS: Role[] = ["coordinator", "finance", "viewer"];

export function roleAllowed(access: Access, session: Session | null): boolean {
  switch (access) {
    case "public":
    case "webhook":
    case "cron": // the route verifies the cron secret; a staff session is also accepted there
      return true;
    case "operator":
      return !!session && OPERATORS.includes(session.role);
    case "staff":
      return !!session && STAFF.includes(session.role);
    case "finance":
      return !!session && session.role === "finance";
    case "resident":
      return !!session && session.role === "resident";
    case "resident-operator":
      return !!session && (session.role === "resident" || OPERATORS.includes(session.role));
  }
}
