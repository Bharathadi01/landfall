import React from "react";

/**
 * Landfall brand mark — the eye of a storm resolving into a landing arc.
 * Two spiral bands (the storm) close around a calm core (the household),
 * sitting on a horizon line (landfall). Works at 16px and 160px.
 */
export function LandfallMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`lf-a-${id}`} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5EEAD4" />
          <stop offset="0.55" stopColor="#54A0FF" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <radialGradient id={`lf-c-${id}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(20 20) rotate(90) scale(6)">
          <stop stopColor="#EEFFFB" />
          <stop offset="1" stopColor="#5EEAD4" />
        </radialGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="11.5" fill="#0C111B" stroke={`url(#lf-a-${id})`} strokeOpacity="0.55" />
      {/* outer storm band */}
      <path
        d="M20 7.5c6.9 0 12.5 5.6 12.5 12.5 0 2.4-.7 4.7-1.9 6.6"
        stroke={`url(#lf-a-${id})`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M20 32.5C13.1 32.5 7.5 26.9 7.5 20c0-2.4.7-4.7 1.9-6.6"
        stroke={`url(#lf-a-${id})`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* inner band */}
      <path d="M13.6 20a6.4 6.4 0 0 1 6.4-6.4" stroke="#54A0FF" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <path d="M26.4 20a6.4 6.4 0 0 1-6.4 6.4" stroke="#5EEAD4" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      {/* calm core */}
      <circle cx="20" cy="20" r="2.6" fill={`url(#lf-c-${id})`} />
    </svg>
  );
}

export function LandfallWordmark({ size = 28, sub }: { size?: number; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LandfallMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Landfall</span>
        {sub && <span className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3">{sub}</span>}
      </span>
    </span>
  );
}
