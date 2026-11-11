"use client";

/**
 * AG Grid Enterprise + AG Studio licensing — registered once, in one place.
 *
 * Keys come from the environment and are never committed:
 *   NEXT_PUBLIC_AG_GRID_LICENSE    AG Grid Enterprise key (never falls back to the Studio key — that key is not valid for the grid)
 *   NEXT_PUBLIC_AG_STUDIO_LICENSE  AG Studio key
 *
 * If a key is missing or invalid, AG's own notice and evaluation watermark stay visible:
 * we do NOT suppress licence messages, so a misconfigured deployment is obvious.
 */
import { LicenseManager } from "ag-grid-enterprise";
import { AgStudioLicenseManager } from "ag-studio";

let registered = false;

/** A key pasted into a hosting dashboard often arrives wrapped in quotes or with stray whitespace/newlines. */
export const cleanKey = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").replace(/[\r\n]+/g, " ").trim();

export function registerAgLicenses(): { grid: boolean; studio: boolean } {
  const studioKey = cleanKey(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE || process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY);
  const gridKey = cleanKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE);
  // Render forms need *some* value, so a placeholder like "x" is treated as "no key".
  const gridValid = gridKey.length > 20;
  if (!registered) {
    registered = true;
    if (gridValid) LicenseManager.setLicenseKey(gridKey);
    if (studioKey) AgStudioLicenseManager.setLicenseKey(studioKey);
  }
  return { grid: gridValid, studio: !!studioKey };
}
