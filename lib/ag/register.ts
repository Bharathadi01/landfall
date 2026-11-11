"use client";

/**
 * One place that registers every AG module the app uses, plus licences.
 * Safe to import from any client component: registration runs once.
 *
 * Licences come from the environment and are never committed:
 *   NEXT_PUBLIC_AG_GRID_LICENSE    AG Grid Enterprise key (required for the grid — it is NOT shared with Studio)
 *   NEXT_PUBLIC_AG_STUDIO_LICENSE  AG Studio key
 * A missing or invalid key leaves AG's own notice and watermark visible on purpose.
 */
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { AllEnterpriseModule, IntegratedChartsModule, SparklinesModule, LicenseManager } from "ag-grid-enterprise";
import { AgChartsCommunityModule } from "ag-charts-community";
import { AgStudioLicenseManager } from "ag-studio";

let done = false;

export function registerAg(): { grid: boolean; studio: boolean } {
  const studioKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE || process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY || "";
  const gridKey = process.env.NEXT_PUBLIC_AG_GRID_LICENSE || "";
  if (!done) {
    done = true;
    ModuleRegistry.registerModules([
      AllCommunityModule,
      AllEnterpriseModule,
      IntegratedChartsModule.with(AgChartsCommunityModule),
      SparklinesModule.with(AgChartsCommunityModule),
    ]);
    if (gridKey) LicenseManager.setLicenseKey(gridKey);
    if (studioKey) AgStudioLicenseManager.setLicenseKey(studioKey);
  }
  return { grid: !!gridKey, studio: !!studioKey };
}
