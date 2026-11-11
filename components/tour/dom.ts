import type { Target } from "./steps";

export const isVisible = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
};

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Deepest visible element whose text contains (or, with `exact`, equals) the given text. The tour's own UI is ignored. */
export function findByText(text: string, exact = false): HTMLElement | null {
  const t = norm(text);
  const all = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((el) => !["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"].includes(el.tagName.toUpperCase()) && !el.closest("[data-tour-ui]"));
  const matches = all.filter((el) => (exact ? norm(el.textContent) === t : norm(el.textContent).includes(t)));
  const set = new Set(matches);
  const deepest = matches.filter((el) => !Array.from(el.children).some((c) => set.has(c as HTMLElement)));
  return deepest.find(isVisible) ?? null;
}

export function findTarget(t: Target | undefined): HTMLElement | null {
  if (!t) return null;
  let el: HTMLElement | null = null;
  if (t.css) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(t.css)).filter((e) => !e.closest("[data-tour-ui]"));
    el = els.find(isVisible) ?? null;
  } else if (t.text) el = findByText(t.text, t.exact === true);
  for (let i = 0; el && i < (t.up ?? 0); i++) el = el.parentElement;
  return el;
}

/** The nearest thing a person would click: the element's button/link/tab ancestor, or the element itself. */
export const clickable = (el: HTMLElement): HTMLElement => (el.closest("button,a,[role=tab],[role=button]") as HTMLElement | null) ?? el;
