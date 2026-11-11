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

export function registerAgLicenses(): { grid: boolean; studio: boolean } {
  const studioKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE || process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY || "";
  const gridKey = process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "";
  if (!registered) {
    registered = true;
    if (gridKey) LicenseManager.setLicenseKey(gridKey);
    if (studioKey) AgStudioLicenseManager.setLicenseKey(studioKey);
  }
  return { grid: !!gridKey, studio: !!studioKey };
}
