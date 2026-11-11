import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseLayerTimes, parseStepMinutes, getImagery, __resetImageryCaches } from "@/lib/sentinel/imagery";
import { gridAxes, windToUV, assembleGrid, getForecastGrid, __resetForecastGridCache } from "@/lib/sentinel/forecast-grid";
import { gibsWmsUrl, radarTileTemplate, gibsTileTemplate } from "@/lib/sentinel/imagery-urls";

const CAPS = `<Capabilities>
<Layer><ows:Identifier>GOES-East_ABI_Band13_Clean_Infrared</ows:Identifier>
<Dimension><Default>2026-11-10T23:00:00Z</Default><Value>2026-08-29T13:10:00Z/2026-08-29T19:10:00Z/PT10M</Value><Value>2026-08-29T19:30:00Z/2026-11-10T23:00:00Z/PT10M</Value></Dimension></Layer>
<Layer><ows:Identifier>IMERG_Precipitation_Rate_30min</ows:Identifier>
<Dimension><Default>2026-11-10T17:30:00Z</Default><Value>2026-01-19T20:30:00Z/2026-11-10T17:30:00Z/PT30M</Value></Dimension></Layer>
</Capabilities>`;

describe("imagery times", () => {
  it("parses cadence", () => {
    expect(parseStepMinutes("PT10M")).toBe(10);
    expect(parseStepMinutes("PT30M")).toBe(30);
    expect(parseStepMinutes("PT1H")).toBe(60);
  });

  it("extracts latest time and builds a 2-hour loop ending at latest", () => {
    const t = parseLayerTimes(CAPS, "GOES-East_ABI_Band13_Clean_Infrared")!;
    expect(t.latest).toBe("2026-11-10T23:00:00Z");
    expect(t.stepMinutes).toBe(10);
    expect(t.frames).toEqual([
      "2026-11-10T21:00:00Z",
      "2026-11-10T21:30:00Z",
      "2026-11-10T22:00:00Z",
      "2026-11-10T22:30:00Z",
      "2026-11-10T23:00:00Z",
    ]);
  });

  it("returns null for an unknown layer instead of inventing times", () => {
    expect(parseLayerTimes(CAPS, "Nope")).toBeNull();
  });
});

describe("getImagery honesty", () => {
  beforeEach(() => __resetImageryCaches());
  afterEach(() => vi.unstubAllGlobals());

  it("reports state=error with no frames when both upstreams fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r = await getImagery();
    expect(r.state).toBe("error");
    expect(r.radar).toBeNull();
    expect(Object.keys(r.gibs)).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("reports partial when only radar works", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("rainviewer")) {
          return new Response(JSON.stringify({ host: "https://tilecache.rainviewer.com", generated: 1, radar: { past: [{ time: 1, path: "/v2/radar/abc" }] } }), { status: 200 });
        }
        throw new Error("gibs down");
      })
    );
    const r = await getImagery();
    expect(r.state).toBe("partial");
    expect(r.radar?.frames).toHaveLength(1);
  });
});

describe("forecast grid", () => {
  beforeEach(() => __resetForecastGridCache());
  afterEach(() => vi.unstubAllGlobals());

  it("lays rows out north→south, columns west→east", () => {
    const { lngs, lats } = gridAxes([-100, 16, -64, 36], 3);
    expect(lngs[0]).toBe(-100);
    expect(lats[0]).toBeGreaterThan(lats[lats.length - 1]);
  });

  it("converts meteorological wind (from) to u/v", () => {
    // wind FROM the north blows toward the south → v negative, u ~ 0
    const n = windToUV(10, 0);
    expect(n.u).toBeCloseTo(0, 5);
    expect(n.v).toBeCloseTo(-10, 5);
    // wind FROM the west blows toward the east → u positive
    const w = windToUV(10, 270);
    expect(w.u).toBeCloseTo(10, 5);
    expect(w.v).toBeCloseTo(0, 5);
  });

  it("assembles per-hour arrays", () => {
    const point = { hourly: { time: ["2026-11-11T00:00", "2026-11-11T01:00"], precipitation: [0, 2], cloud_cover: [10, 90], wind_speed_10m: [5, 20], wind_direction_10m: [90, 180], wind_gusts_10m: [8, 30] } };
    const g = assembleGrid([point, point], [-100, -97], [16], [-100, 16, -97, 16], 48);
    expect(g.hours).toHaveLength(2);
    expect(g.speedKt[1]).toEqual([20, 20]);
    expect(g.precipMm[1][0]).toBe(2);
  });

  it("never fabricates a field when Open-Meteo fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const g = await getForecastGrid();
    expect(g.state).toBe("error");
    expect(g.hours).toEqual([]);
    expect(g.u).toEqual([]);
  });
});

describe("url builders", () => {
  it("builds a 4326 WMS URL", () => {
    const u = gibsWmsUrl({ layer: "GOES-East_ABI_Band13_Clean_Infrared", time: "2026-11-10T23:00:00Z" });
    expect(u).toContain("SRS=EPSG%3A4326");
    expect(u).toContain("BBOX=-180%2C-90%2C180%2C90");
    expect(u).toContain("TIME=2026-11-10T23%3A00%3A00Z");
  });
  it("builds tile templates", () => {
    expect(radarTileTemplate("https://tilecache.rainviewer.com", "/v2/radar/abc")).toBe("https://tilecache.rainviewer.com/v2/radar/abc/256/{z}/{x}/{y}/2/1_1.png");
    expect(gibsTileTemplate("L", "T", 6)).toContain("GoogleMapsCompatible_Level6/{z}/{y}/{x}.png");
  });
});
