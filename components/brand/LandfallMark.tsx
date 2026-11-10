import React from "react";

/**
 * Landfall mark — a flare-orange tile with a storm spiral cut out of it, around a calm core (the household).
 * Solid warm fill so it reads on glass and in a favicon. Works at 16px and 160px.
 */
export function LandfallMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`lf-f-${id}`} x1="6" y1="2" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFA46B" />
          <stop offset="0.55" stopColor="#FF6B2C" />
          <stop offset="1" stopColor="#F2A93C" />
        </linearGradient>
        <linearGradient id={`lf-h-${id}`} x1="20" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#lf-f-${id})`} />
      <rect width="40" height="40" rx="12" fill={`url(#lf-h-${id})`} />
      {/* storm arms, cut out in canvas ink */}
      <path d="M20 8.6c6.3 0 11.4 5.1 11.4 11.4" stroke="#1F0C02" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 31.4c-6.3 0-11.4-5.1-11.4-11.4" stroke="#1F0C02" strokeWidth="3" strokeLinecap="round" />
      <path d="M14.4 20a5.6 5.6 0 0 1 5.6-5.6" stroke="#1F0C02" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M25.6 20a5.6 5.6 0 0 1-5.6 5.6" stroke="#1F0C02" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2.3" fill="#1F0C02" />
    </svg>
  );
}

export function LandfallWordmark({ size = 28, sub }: { size?: number; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LandfallMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="font-serif text-[20px] font-medium tracking-[-0.03em] text-ink"
          style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1' }}
        >
          Landfall
        </span>
        {sub && <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">{sub}</span>}
      </span>
    </span>
  );
}
