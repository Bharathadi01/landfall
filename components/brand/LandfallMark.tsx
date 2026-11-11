import React from "react";

/**
 * Landfall mark — a location pin whose centre is a storm spiral: the exact place a storm meets land, and the household
 * that has to be reached. A warm glass-gradient pin with the spiral cut out of it; reads at 16 px and at 160 px.
 */
export function LandfallMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`lf-p-${id}`} x1="8" y1="3" x2="32" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB27A" />
          <stop offset="0.5" stopColor="#FF6B2C" />
          <stop offset="1" stopColor="#E8892B" />
        </linearGradient>
        <radialGradient id={`lf-g-${id}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(14 9) rotate(60) scale(14 12)">
          <stop stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* soft ground shadow under the tip */}
      <ellipse cx="20" cy="37.2" rx="6.5" ry="1.4" fill="#000" opacity="0.28" />
      {/* the pin */}
      <path d="M20 36.5C20 36.5 6.5 25.6 6.5 16a13.5 13.5 0 0 1 27 0C33.5 25.6 20 36.5 20 36.5Z" fill={`url(#lf-p-${id})`} />
      <path d="M20 36.5C20 36.5 6.5 25.6 6.5 16a13.5 13.5 0 0 1 27 0C33.5 25.6 20 36.5 20 36.5Z" fill={`url(#lf-g-${id})`} />
      {/* storm spiral cut out of the pin, around a calm core */}
      <path d="M20 8.6a7.4 7.4 0 0 1 7.4 7.4" stroke="#1F0C02" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 23.4A7.4 7.4 0 0 1 12.6 16" stroke="#1F0C02" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16.6 16a3.4 3.4 0 0 1 3.4-3.4" stroke="#1F0C02" strokeWidth="2" strokeLinecap="round" />
      <path d="M23.4 16a3.4 3.4 0 0 1-3.4 3.4" stroke="#1F0C02" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="16" r="1.7" fill="#1F0C02" />
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
