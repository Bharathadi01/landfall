"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RELIEF_CASES, type EvidenceRow, type Provenance } from "@/lib/relief/cases";

/**
 * RECOVERY EVIDENCE CHAIN — a custom AG Studio widget.
 *
 * Shows, for one case, every piece of evidence behind a relief payment: who says so
 * (PayPal / Landfall / resident / operator), and what is MISSING — never fabricated.
 *
 * It reads Studio's own data engine through `widgetApi.getDataHandle()`, so the list of cases it
 * offers always follows page filters and cross-filters. Picking a case cross-filters the rest of
 * the page (workbench grid, charts) to that item.
 */

const PROV_STYLE: Record<Provenance, { label: string; color: string }> = {
  PROVIDER: { label: "PayPal", color: "#4C9BFF" },
  INTERNAL: { label: "Landfall", color: "#B9B3AA" },
  RECIPIENT_REPORTED: { label: "Resident", color: "#8FE4B3" },
  OPERATOR_ATTESTED: { label: "Operator", color: "#FFB020" },
};

const STATE_STYLE = {
  present: { label: "Present", color: "#8FE4B3", bg: "rgba(111,212,154,0.10)", border: "rgba(111,212,154,0.28)" },
  missing: { label: "Missing", color: "#FFB020", bg: "rgba(255,176,32,0.10)", border: "rgba(255,176,32,0.32)" },
  not_expected: { label: "Not expected", color: "#8A847B", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.10)" },
} as const;

export const EVIDENCE_CHAIN_WIDGET_TYPE = "landfall-evidence-chain";

/** Queried straight from Studio's data engine (so page filters and cross-filters apply). */
const ITEM_FIELD = { id: "payout_items.item_id" };

export function RecoveryEvidenceChainWidget(props: any) {
  const { widgetApi } = props;
  const itemField = ITEM_FIELD;
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Live subscription to the items that survive the page's filters and cross-filters.
  useEffect(() => {
    if (!widgetApi || !itemField || typeof widgetApi.getDataHandle !== "function") return;
    let handle: any;
    try {
      handle = widgetApi.getDataHandle();
      handle.set("items", { query: { fields: [itemField] } });
      handle.open((update: any) => {
        const res = update?.results?.find((r: any) => r.key === "items");
        const rows: any[] = res?.response?.results?.rows ?? [];
        setVisibleIds(rows.map((r) => String(r[itemField.id] ?? Object.values(r)[0])));
      });
    } catch {
      /* data handle unavailable: show all cases */
    }
    return () => {
      try {
        handle?.close();
      } catch {
        /* already closed */
      }
    };
  }, [widgetApi, itemField]);

  const candidates = useMemo(() => {
    const pool = visibleIds ? RELIEF_CASES.filter((c) => visibleIds.includes(c.itemId)) : RELIEF_CASES;
    return [...(pool.length ? pool : RELIEF_CASES)].sort((a, b) => b.priority.score - a.priority.score);
  }, [visibleIds]);

  const current = candidates.find((c) => c.itemId === selected) ?? candidates[0];
  const evidence: EvidenceRow[] = current?.evidence ?? [];
  const present = evidence.filter((e) => e.state === "present").length;
  const applicable = evidence.filter((e) => e.state !== "not_expected").length;

  /** Select a case and filter the rest of the page to it by writing the page's cross-filter state. Click again to clear. */
  const pick = (itemId: string) => {
    const isSame = current?.itemId === itemId && selected === itemId;
    setSelected(isSame ? null : itemId);
    setOpen(null);
    const api = props.api;
    const widgetId = props.widgetId ?? "w-evidence-chain";
    try {
      const state = api.getState();
      const pageId = state.selectedPageId ?? state.pages?.[0]?.id;
      const pages = state.pages.map((p: any) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              crossFilter: {
                values: isSame ? {} : { [widgetId]: [{ type: "value", group: 0, field: { id: "payout_items.item_id" }, values: [itemId] }] },
              },
            }
      );
      api.setState({ ...state, pages }, { historyLabel: isSame ? "Clear case filter" : `Case ${itemId}`, source: { type: "ui" } });
    } catch {
      /* cross-filter unavailable: selection stays local to this widget */
    }
  };

  if (!current) return null;

  return (
    <div data-testid="evidence-chain-widget" style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", padding: "2px 4px", fontFamily: "var(--font-geist-sans), system-ui", color: "#F3EFE8", overflow: "auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A847B", fontFamily: "var(--font-geist-mono)" }}>Evidence behind this payment</div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}>
            {current.resident} · <span style={{ color: "#4C9BFF" }}>{current.status}</span> · ${current.amountUsd}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: present === applicable ? "#8FE4B3" : "#FFB020",
            background: present === applicable ? "rgba(111,212,154,0.10)" : "rgba(255,176,32,0.10)",
            border: `1px solid ${present === applicable ? "rgba(111,212,154,0.3)" : "rgba(255,176,32,0.32)"}`,
            borderRadius: 999,
            padding: "4px 10px",
          }}
        >
          {present} of {applicable} evidence present
        </div>
      </div>

      <div role="tablist" aria-label="Cases" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {candidates.slice(0, 8).map((c) => (
          <button
            key={c.itemId}
            role="tab"
            aria-selected={c.itemId === current.itemId}
            onClick={() => pick(c.itemId)}
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono)",
              padding: "3px 9px",
              borderRadius: 999,
              cursor: "pointer",
              color: c.itemId === current.itemId ? "#F3EFE8" : "#B9B3AA",
              background: c.itemId === current.itemId ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${c.itemId === current.itemId ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {c.itemId.replace("item_milton_", "#")}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 8 }}>
        {evidence.map((e) => {
          const st = STATE_STYLE[e.state];
          const pv = PROV_STYLE[e.provenance];
          const isOpen = open === e.key;
          return (
            <button
              key={e.key}
              onClick={() => setOpen(isOpen ? null : e.key)}
              aria-expanded={isOpen}
              style={{ textAlign: "left", cursor: "pointer", padding: 9, borderRadius: 12, color: "inherit", background: st.bg, border: `1px solid ${isOpen ? st.color : st.border}`, display: "flex", flexDirection: "column", gap: 5 }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{e.title}</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", textTransform: "uppercase", color: pv.color, border: `1px solid ${pv.color}55`, borderRadius: 999, padding: "2px 6px", whiteSpace: "nowrap" }}>{pv.label}</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{e.state === "present" ? "✓ " : e.state === "missing" ? "● " : "– "}{st.label}</span>
              <span style={{ fontSize: 10.5, color: "#B9B3AA", lineHeight: 1.35, display: isOpen ? "block" : "-webkit-box", WebkitLineClamp: isOpen ? undefined : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.detail}</span>
              {isOpen && e.ref && <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "#4C9BFF", wordBreak: "break-all" }}>{e.ref}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 10.5, color: "#8A847B" }}>
        Replay data. PayPal status is provider-reported; a resident’s confirmation is self-reported and never upgraded to PayPal’s. Missing evidence is shown as missing.
      </div>
    </div>
  );
}
