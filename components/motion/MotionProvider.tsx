"use client";

import React, { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Global GSAP choreography.
 * Any element with `data-reveal` fades/lifts in as it enters the viewport, in batches,
 * so whole rows of cards cascade. `data-reveal="scale"` uses a scale-in instead.
 * Re-runs on every route change.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useIsoLayoutEffect(() => {
    // Backdrop refraction through an SVG filter only works in Chromium; everything else keeps plain blur.
    const ua = navigator.userAgent;
    if (/Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua)) document.documentElement.classList.add("supports-refract");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    document.documentElement.classList.add("js-motion");

    const ctx = gsap.context(() => {
      const run = () => {
        const targets = gsap.utils
          .toArray<HTMLElement>(".reveal-scope [data-reveal]")
          .filter((el) => !el.dataset.revealed);
        if (!targets.length) return;
        targets.forEach((el) => (el.dataset.revealed = "1"));

        ScrollTrigger.batch(targets, {
          start: "top 97%",
          once: true,
          onEnter: (batch) => {
            const scaleEls = batch.filter((el) => (el as HTMLElement).dataset.reveal === "scale");
            const liftEls = batch.filter((el) => (el as HTMLElement).dataset.reveal !== "scale");
            if (liftEls.length)
              gsap.fromTo(
                liftEls,
                { opacity: 0, y: 18, filter: "blur(6px)" },
                { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "expo.out", stagger: 0.06, clearProps: "filter,transform" }
              );
            if (scaleEls.length)
              gsap.fromTo(
                scaleEls,
                { opacity: 0, scale: 0.96 },
                { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out", stagger: 0.08, clearProps: "transform" }
              );
          },
        });
      };

      run();
      // Catch content that mounts a beat later (dynamic imports, data fetches).
      const t1 = window.setTimeout(run, 400);
      const t2 = window.setTimeout(() => { run(); ScrollTrigger.refresh(); }, 1200);
      return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    });

    return () => ctx.revert();
  }, [pathname]);

  return <>{children}</>;
}
