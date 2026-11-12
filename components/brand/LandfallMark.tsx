import React from "react";

/**
 * Landfall mark — a roof over a sun rising on the coastline, with the sea beneath.
 *   the roof     shelter: help that reaches a home
 *   the sun      the morning after the storm: hope, and help that arrives in time
 *   the horizon  landfall itself, where the sea meets the land
 * Drawn on a refuge-green tile (the green of first-aid and safe-exit signs). Reads at 16 px and at 160 px.
 */
export function LandfallMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#0E6B50" />
      <path d="M13 27a7 7 0 0 1 14 0Z" fill="#F2B544" />
      <path d="M8.5 19.5 20 10l11.5 9.5" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 27h23" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11.5 31.6c1.7 0 1.7-1.3 3.4-1.3s1.7 1.3 3.4 1.3 1.7-1.3 3.4-1.3 1.7 1.3 3.4 1.3 1.7-1.3 3.4-1.3" stroke="#8FCDB4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LandfallWordmark({ size = 28, sub }: { size?: number; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LandfallMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[19px] font-semibold tracking-[-0.035em] text-ink" style={{ fontStretch: "118%" }}>
          Landfall
        </span>
        {sub && <span className="mt-1 text-[12px] text-ink-3">{sub}</span>}
      </span>
    </span>
  );
}
