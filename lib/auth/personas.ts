import type { Role } from "./session";

/**
 * Demo personas. They are FICTIONAL people used so a judge can use every console feature in one click.
 * Every surface that shows them labels them as demo personas. They are not real accounts.
 */
export interface Persona {
  id: string;
  name: string;
  title: string;
  role: Exclude<Role, "resident">;
  can: string[];
  cannot: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "dana-ortiz",
    name: "Dana Ortiz",
    title: "Relief coordinator",
    role: "coordinator",
    can: ["Propose payments and recovery actions", "Investigate cases with the AI", "Approve (first key)", "Refresh status from PayPal"],
    cannot: ["Be the Finance approver"],
  },
  {
    id: "sam-patel",
    name: "Sam Patel",
    title: "Finance director",
    role: "finance",
    can: ["Approve (second key, Finance)", "Run reconciliation", "Export the accountability report", "Everything a viewer can"],
    cannot: ["Be the first approver on the same proposal"],
  },
  {
    id: "judge-viewer",
    name: "Judge (read-only)",
    title: "Read-only viewer",
    role: "viewer",
    can: ["Open every screen and case", "Run the AI investigation", "Switch between live Sandbox and replay data"],
    cannot: ["Propose or approve any money movement"],
  },
];

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id);
