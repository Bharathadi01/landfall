"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { I } from "@/components/icons";
import { CASE_SUMMARY } from "@/lib/relief/cases";
import { TREASURY } from "@/lib/studio/landfall-studio-data";

gsap.registerPlugin(useGSAP);

/**
 * The hero "story in one loop": an official warning appears, households in the storm's path light up,
 * the AI checks the plan, two people approve, and PayPal relief lands — before the eye reaches the coast.
 */
const HOUSES = [
  { x: 318, y: 238 },
  { x: 352, y: 286 },
  { x: 296, y: 312 },
  { x: 380, y: 222 },
  { x: 340, y: 352 },
];

export function StormRadarHero() {
  const coverage = TREASURY.needsReissue > 0 ? (Math.round((TREASURY.allocatable / TREASURY.needsReissue) * 10) / 10).toFixed(1) : "—";
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.set(".rh-card", { autoAlpha: 0, y: 14, scale: 0.96 });
      gsap.set(".rh-house", { scale: 0, transformOrigin: "center" });
      gsap.set(".rh-paid", { scale: 0, autoAlpha: 0, transformOrigin: "center" });

      if (reduce) {
        gsap.set(".rh-card", { autoAlpha: 1, y: 0, scale: 1 });
        gsap.set(".rh-house", { scale: 1 });
        gsap.set(".rh-paid", { scale: 1, autoAlpha: 1 });
        return;
      }

      // Storm drifts toward the coast continuously.
      gsap.fromTo(".rh-storm", { x: 140, y: -70, rotate: 0 }, { x: 40, y: -10, rotate: -360, duration: 16, ease: "none", repeat: -1, yoyo: true });
      gsap.to(".rh-spin", { rotate: -360, duration: 10, ease: "none", repeat: -1, transformOrigin: "center" });

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 0.6 });
      tl.to(".rh-warning", { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" })
        .to(".rh-house", { scale: 1, duration: 0.5, stagger: 0.07, ease: "back.out(2.4)" }, "-=0.2")
        .to(".rh-ai", { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, "+=0.3")
        .to(".rh-approve", { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, "+=0.4")
        .to(".rh-paid", { scale: 1, autoAlpha: 1, duration: 0.45, stagger: 0.09, ease: "back.out(3)" }, "+=0.3")
        .to(".rh-sent", { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, "-=0.4")
        .to({}, { duration: 2.6 })
        .to([".rh-card"], { autoAlpha: 0, y: -8, duration: 0.5, stagger: 0.05 })
        .to(".rh-paid", { autoAlpha: 0, scale: 0, duration: 0.3 }, "<")
        .to(".rh-house", { scale: 0, duration: 0.3 }, "<");
    },
    { scope: root }
  );

  return (
    <div ref={root} className="relative aspect-square w-full max-w-[620px]">
      {/* Radar */}
      <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="rh-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4C9BFF" stopOpacity="0.10" />
            <stop offset="70%" stopColor="#6FD49A" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#0A0A0C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rh-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6FD49A" stopOpacity="0" />
            <stop offset="100%" stopColor="#6FD49A" stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id="rh-eye" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF4FA3" stopOpacity="0" />
            <stop offset="35%" stopColor="#FF4FA3" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF4FA3" stopOpacity="0" />
          </radialGradient>
          <clipPath id="rh-clip">
            <circle cx="300" cy="300" r="290" />
          </clipPath>
        </defs>

        <circle cx="300" cy="300" r="290" fill="url(#rh-bg)" />
        {[290, 220, 150, 80].map((r) => (
          <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeDasharray={r === 290 ? "0" : "2 6"} />
        ))}
        <line x1="10" y1="300" x2="590" y2="300" stroke="rgba(255,255,255,0.05)" />
        <line x1="300" y1="10" x2="300" y2="590" stroke="rgba(255,255,255,0.05)" />

        <g clipPath="url(#rh-clip)">
          {/* Coastline (stylised Gulf coast) */}
          <path
            d="M120 120 C 200 150, 240 170, 260 220 C 275 260, 240 300, 250 340 C 262 390, 300 420, 290 470 C 284 510, 300 560, 330 600 L 0 600 L 0 120 Z"
            fill="rgba(111,212,154,0.05)"
            stroke="rgba(111,212,154,0.35)"
            strokeWidth="1.2"
            transform="translate(140 0)"
          />
          {/* Warning polygon */}
          <path
            d="M380 180 L 470 200 L 480 330 L 430 390 L 360 380 L 350 260 Z"
            transform="translate(-110 -10)"
            fill="rgba(255,79,163,0.08)"
            stroke="rgba(255,79,163,0.65)"
            strokeDasharray="5 5"
            className="animate-dash"
          />
          {/* Sweep */}
          <g style={{ transformOrigin: "300px 300px", animation: "radar-sweep 5s linear infinite" }}>
            <path d="M300 300 L 590 300 A 290 290 0 0 0 505 95 Z" fill="url(#rh-sweep)" opacity="0.6" />
          </g>

          {/* Storm */}
          <g className="rh-storm" style={{ transformOrigin: "460px 200px" }}>
            <circle cx="460" cy="200" r="120" fill="url(#rh-eye)" />
            <g className="rh-spin" style={{ transformOrigin: "460px 200px" }}>
              {[0, 120, 240].map((a) => (
                <path
                  key={a}
                  d="M460 200 C 500 160, 560 170, 570 220 C 575 250, 555 275, 530 280"
                  fill="none"
                  stroke="rgba(255,150,120,0.55)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  transform={`rotate(${a} 460 200)`}
                />
              ))}
            </g>
            <circle cx="460" cy="200" r="9" fill="#0A0A0C" stroke="rgba(255,200,180,0.9)" strokeWidth="2" />
          </g>

          {/* Households */}
          {HOUSES.map((h, i) => (
            <g key={i}>
              <circle className="rh-house" cx={h.x} cy={h.y} r="6" fill="#B9B3AA" stroke="#0A0A0C" strokeWidth="2" />
              <g className="rh-paid">
                <circle cx={h.x} cy={h.y} r="15" fill="rgba(111,212,154,0.18)" />
                <circle cx={h.x} cy={h.y} r="7" fill="#6FD49A" stroke="#0A0A0C" strokeWidth="2" />
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* Story cards */}
      <div className="rh-card rh-warning glass-strong absolute left-[2%] top-[8%] w-[230px] p-3.5" style={{ borderRadius: 16 }}>
        <div className="flex items-center gap-2.5">
          <span className="icon-tile icon-tile-sm tone-storm"><I.stormEye /></span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-storm">NWS · Official</div>
            <div className="text-[13px] font-semibold text-ink">Hurricane Warning issued</div>
          </div>
        </div>
        <div className="mt-2 text-[11.5px] text-ink-3">{CASE_SUMMARY.households} enrolled households in the path</div>
      </div>

      <div className="rh-card rh-ai glass-strong absolute right-[0%] top-[40%] w-[220px] p-3.5" style={{ borderRadius: 16 }}>
        <div className="flex items-center gap-2.5">
          <span className="icon-tile icon-tile-sm tone-ai"><I.aiAdvisor /></span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ai">AI check · read-only</div>
            <div className="text-[13px] font-semibold text-ink">No duplicates. Fund covers {coverage}×</div>
          </div>
        </div>
      </div>

      <div className="rh-card rh-approve glass-strong absolute bottom-[22%] left-[0%] w-[220px] p-3.5" style={{ borderRadius: 16 }}>
        <div className="flex items-center gap-2.5">
          <span className="icon-tile icon-tile-sm tone-amber"><I.twoKeyApproval /></span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber">Two-person approval</div>
            <div className="text-[13px] font-semibold text-ink">Coordinator ✓ · Finance ✓</div>
          </div>
        </div>
      </div>

      <div className="rh-card rh-sent glass-strong absolute bottom-[4%] right-[6%] w-[250px] p-3.5" style={{ borderRadius: 16, boxShadow: "var(--glow-accent)" }}>
        <div className="flex items-center gap-2.5">
          <span className="icon-tile icon-tile-sm tone-paypal"><I.send /></span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-paypal">PayPal Payouts</div>
            <div className="text-[13px] font-semibold text-ink">${CASE_SUMMARY.approvedUsd.toLocaleString("en-US")} sent · 12h before landfall</div>
          </div>
        </div>
      </div>
    </div>
  );
}
