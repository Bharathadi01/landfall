import React from "react";

/**
 * Landfall's own glyphs — one per domain concept the product is about.
 * 24×24, 1.6 stroke, round caps, with a translucent "duotone" fill so they sit next to Phosphor duotone icons.
 * Server-safe (no hooks).
 */
export type IconType = React.ComponentType<{ className?: string; strokeWidth?: number; size?: number }>;

function glyph(name: string, body: React.ReactNode): IconType {
  const C: IconType = ({ className, size }) => (
    <svg
      viewBox="0 0 24 24"
      width={size ?? "1em"}
      height={size ?? "1em"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {body}
    </svg>
  );
  C.displayName = `Glyph(${name})`;
  return C;
}

const tint = { fill: "currentColor", fillOpacity: 0.18, stroke: "none" } as const;

/** Hurricane: calm eye, two spiral arms. */
export const StormEye = glyph(
  "StormEye",
  <>
    <circle cx="12" cy="12" r="8.6" {...tint} />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <path d="M12 10.3C12 7.2 9.4 5 6.4 5.4 4.6 5.7 3.4 6.9 3 8.4" />
    <path d="M12 13.7c0 3.1 2.6 5.3 5.6 4.9 1.8-.3 3-1.5 3.4-3" />
  </>
);

/** Forecast cone fanning out from the storm's position. */
export const ForecastCone = glyph(
  "ForecastCone",
  <>
    <path d="M5.4 16.2 20.5 6.2v11.6Z" {...tint} />
    <path d="M5.4 16.2 20.5 6.2M5.4 16.2l15.1 1.6" />
    <path d="M7.5 15.9 20.5 12" strokeDasharray="1.6 2.4" />
    <circle cx="5.4" cy="16.2" r="1.9" fill="currentColor" stroke="none" />
  </>
);

/** Radar scope with sweep. */
export const Radar = glyph(
  "Radar",
  <>
    <path d="M12 12 20.2 7.3A9.4 9.4 0 0 0 12 2.6Z" {...tint} />
    <circle cx="12" cy="12" r="9.4" />
    <circle cx="12" cy="12" r="5.2" />
    <path d="M12 12 19.2 6" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </>
);

/** Weather satellite with signal arcs. */
export const Satellite = glyph(
  "Satellite",
  <>
    <g transform="rotate(-42 12 11)">
      <rect x="9.2" y="8.4" width="5.6" height="5.2" rx="1.2" {...tint} />
      <rect x="9.2" y="8.4" width="5.6" height="5.2" rx="1.2" />
      <rect x="2.6" y="8.8" width="5" height="4.4" rx="0.8" />
      <rect x="16.4" y="8.8" width="5" height="4.4" rx="0.8" />
      <path d="M7.6 11H9.2M14.8 11h1.6" />
    </g>
    <path d="M5.2 19a5.2 5.2 0 0 0 4.6.9M4 15.8a8.6 8.6 0 0 0 7 4" />
  </>
);

/** Money leaving: a coin with an outbound arrow. */
export const Payout = glyph(
  "Payout",
  <>
    <circle cx="9.2" cy="14.2" r="6" {...tint} />
    <circle cx="9.2" cy="14.2" r="6" />
    <path d="M9.2 11.6v5.2M7.6 13h2.8a1 1 0 0 1 0 2H8" strokeWidth={1.4} />
    <path d="M15.2 8.6 20.4 3.6M20.4 3.6h-4.2M20.4 3.6v4.2" />
  </>
);

/** Double-entry ledger: debit | credit. */
export const Ledger = glyph(
  "Ledger",
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" {...tint} />
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M12 4v16M4 9.2h16" />
    <path d="M7 12.6h2.4M7 16h2.4M14.6 12.6H17M14.6 16H17" />
  </>
);

/** Two keys, one plan: two people must sign. */
export const TwoKeyApproval = glyph(
  "TwoKeyApproval",
  <>
    <circle cx="7.6" cy="8" r="3" {...tint} />
    <circle cx="16.4" cy="8" r="3" {...tint} />
    <circle cx="7.6" cy="8" r="3" />
    <circle cx="16.4" cy="8" r="3" />
    <path d="M9.8 10.2 15.4 19.2M15.4 19.2l1.9-.7M13.6 16.3l1.7-1" />
    <path d="M14.2 10.2 8.6 19.2M8.6 19.2l-1.9-.7M10.4 16.3l-1.7-1" />
  </>
);

/** A household: house with its door. */
export const Household = glyph(
  "Household",
  <>
    <path d="M4 11 12 4l8 7v8.4a1.1 1.1 0 0 1-1.1 1.1H5.1A1.1 1.1 0 0 1 4 19.4Z" {...tint} />
    <path d="M4 11 12 4l8 7v8.4a1.1 1.1 0 0 1-1.1 1.1H5.1A1.1 1.1 0 0 1 4 19.4Z" />
    <path d="M10 20.5v-5.2h4v5.2" />
  </>
);

/** Evidence: a stamped document. */
export const Evidence = glyph(
  "Evidence",
  <>
    <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...tint} />
    <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h4" />
    <path d="m8.6 14.6 2.2 2.2 4.4-4.7" />
  </>
);

/** Protected reserve: stacked coins above a floor line. */
export const Reserve = glyph(
  "Reserve",
  <>
    <ellipse cx="12" cy="7" rx="6.5" ry="2.5" {...tint} />
    <ellipse cx="12" cy="7" rx="6.5" ry="2.5" />
    <path d="M5.5 7v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V7" />
    <path d="M5.5 11v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4" />
    <path d="M3 20.6h18" strokeDasharray="2 2.2" />
  </>
);

/** Recovery: a loop of return with a plus at its heart. */
export const Recovery = glyph(
  "Recovery",
  <>
    <circle cx="12" cy="12" r="3.2" {...tint} />
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20.2 4.2v4.1h-4.1" />
    <path d="M12 9.9v4.2M9.9 12h4.2" />
  </>
);

/** AI advisor: an open eye with a sparkle for a pupil — it watches and advises, it doesn't act. */
export const AiAdvisor = glyph(
  "AiAdvisor",
  <>
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" {...tint} />
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
    <path d="M12 8.6c.3 2 .8 2.5 2.8 2.8-2 .3-2.5.8-2.8 2.8-.3-2-.8-2.5-2.8-2.8 2-.3 2.5-.8 2.8-2.8Z" fill="currentColor" stroke="none" />
  </>
);

/** Donation: a coin dropping into a cup. */
export const Donation = glyph(
  "Donation",
  <>
    <circle cx="12" cy="6.2" r="3.2" {...tint} />
    <circle cx="12" cy="6.2" r="3.2" />
    <path d="M4.4 13.4h15.2l-1.5 5.9a1.2 1.2 0 0 1-1.2.9H7.1a1.2 1.2 0 0 1-1.2-.9Z" {...tint} />
    <path d="M4.4 13.4h15.2l-1.5 5.9a1.2 1.2 0 0 1-1.2.9H7.1a1.2 1.2 0 0 1-1.2-.9Z" />
  </>
);

/** Webhook: three nodes passing an event. */
export const Webhook = glyph(
  "Webhook",
  <>
    <path d="m12 7.2-4.6 8.2M12 7.2l4.6 8.2M8.6 17.6h6.8" />
    <circle cx="12" cy="5.4" r="2.4" {...tint} />
    <circle cx="12" cy="5.4" r="2.4" />
    <circle cx="6.2" cy="17.6" r="2.4" />
    <circle cx="17.8" cy="17.6" r="2.4" />
  </>
);
