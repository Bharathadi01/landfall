"use client";

/**
 * StormDesk — the live weather globe.
 *
 * Real data only:
 *   clouds   NASA GIBS GOES-East / GOES-West / Himawari infrared, lifted into 3D (CloudDeckLayer)
 *   radar    RainViewer mosaic (raster tiles) + the same radar driving falling rain (RainLayer)
 *   forecast Open-Meteo model grid → wind particles, forecast cloud cover and rain, +48 h
 *   hazards  NWS warning polygons, NHC active storms
 * Replay data (Hurricane Milton 2024) is only drawn when the page is in replay mode, and is always labelled.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { I } from "@/components/icons";
import { Tag } from "@/components/ui/Tag";
import { LowerThird } from "@/components/ui/LowerThird";
import { NewsCrawl, type CrawlItem } from "@/components/ui/NewsCrawl";
import { cn } from "@/lib/utils";
import type { NormalizedAlert } from "@/lib/sentinel/types";
import type { ClusterExposureSummary, ExposureCluster } from "@/lib/sentinel/clusters";
import type { CommunityFundGeoScope, NHCActiveStorm, WeatherSystemState } from "@/lib/sentinel/weather-client";
import type { ImageryPayload } from "@/lib/sentinel/imagery";
import { GRID_PAST_HOURS, type ForecastGrid } from "@/lib/sentinel/forecast-grid";
import { gibsTileTemplate, radarTileTemplate, GIBS_LAYERS, RADAR_MAX_ZOOM } from "@/lib/sentinel/imagery-urls";
import { MILTON_CONE_OF_UNCERTAINTY_GEOJSON, getMiltonTrackGeoJSON } from "@/lib/sentinel/nhc-track";
import { CloudDeckLayer } from "./gl/CloudDeckLayer";
import { RainLayer } from "./gl/RainLayer";
import { WindLayer } from "./gl/WindLayer";
import { NightLayer } from "./gl/NightLayer";
import { compositeFrame, type CompositeFrame, COMPOSITE_W, COMPOSITE_H } from "./satelliteComposite";
import { GridField, RadarField, forecastPrecipSampler, windFieldAt } from "./fields";
import {
  CameraPresets, LayerChips, Legends, Timeline, FC_MIN, OBS_MIN,
  minutesToSlider, sliderToMinutes, type CameraPreset, type DeskLayerKey,
} from "./hud";
import { WeatherMap } from "../WeatherMap";

export interface StormDeskProps {
  fund: CommunityFundGeoScope;
  alerts: NormalizedAlert[];
  clusters: ClusterExposureSummary | null;
  nhcStorms?: NHCActiveStorm[];
  mode?: WeatherSystemState | "HISTORICAL_REPLAY";
  onSelectCluster?: (c: ExposureCluster) => void;
  onSelectAlert?: (a: NormalizedAlert) => void;
  /** "hero" = no HUD, slow auto-rotation (landing page). "panel" = compact interactive map with no HUD (beside the case grid). */
  variant?: "desk" | "hero" | "panel";
  /** Fly the camera here when it changes (panel / desk). */
  focusPoint?: { lng: number; lat: number; zoom?: number; key?: string } | null;
  className?: string;
}

const PRESETS: Record<CameraPreset, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  globe: { center: [-72, 24], zoom: 2.35, pitch: 0, bearing: 0 },
  gulf: { center: [-85.5, 26.5], zoom: 4.3, pitch: 38, bearing: -8 },
  bay: { center: [-82.7, 27.6], zoom: 7.4, pitch: 58, bearing: -18 },
};

/** Official NWS hazard colours. */
export function hazardColor(a: Pick<NormalizedAlert, "event" | "phenomena">): string {
  const e = (a.event || "").toLowerCase();
  if (e.includes("tornado warning")) return "#FF0000";
  if (e.includes("hurricane warning")) return "#DC143C";
  if (e.includes("hurricane watch")) return "#FF00FF";
  if (e.includes("tropical storm warning")) return "#B22222";
  if (e.includes("tropical storm watch")) return "#F08080";
  if (e.includes("storm surge warning")) return "#B524F7";
  if (e.includes("storm surge watch")) return "#DB7FF7";
  if (e.includes("flash flood warning")) return "#8B0000";
  if (e.includes("flood warning")) return "#00FF00";
  if (e.includes("flood watch")) return "#2E8B57";
  if (e.includes("severe thunderstorm warning")) return "#FFA500";
  if (e.includes("warning")) return "#FFA500";
  if (e.includes("watch")) return "#FFFF00";
  return "#FFB020";
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Latest satellite composite with the model's cloud cover blended in over the forecast bbox. */
function buildForecastFrame(base: CompositeFrame, grid: ForecastGrid, hour: number, wipe: number): CompositeFrame {
  const out = base.data.slice();
  const [w, s, e, n] = grid.bbox;
  const W = COMPOSITE_W, H = COMPOSITE_H;
  const x0 = Math.max(0, Math.floor(((w + 180) / 360) * W)), x1 = Math.min(W - 1, Math.ceil(((e + 180) / 360) * W));
  const y0 = Math.max(0, Math.floor(((90 - n) / 180) * H)), y1 = Math.min(H - 1, Math.ceil(((90 - s) / 180) * H));
  const cloud = new GridField(grid.bbox, grid.nx, grid.ny, Float32Array.from(grid.cloudPct[Math.max(0, Math.min(grid.hours.length - 1, hour))]));
  for (let y = y0; y <= y1; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    for (let x = x0; x <= x1; x++) {
      const lng = -180 + ((x + 0.5) / W) * 360;
      const c = cloud.at(lng, lat);
      if (c === null) continue;
      const feather = Math.min(smooth(0, 3, lng - w), smooth(0, 3, e - lng), smooth(0, 3, lat - s), smooth(0, 3, n - lat));
      const t = wipe * feather;
      if (t <= 0) continue;
      const target = (0.3 + 0.62 * Math.pow(c / 100, 1.3)) * 255;
      const p = (y * W + x) * 4;
      out[p] = out[p] * (1 - t) + target * t;
      out[p + 1] = out[p + 1] * (1 - t) + target * t;
      out[p + 2] = out[p + 2] * (1 - t) + target * t;
      out[p + 3] = out[p + 3] * (1 - t) + 255 * t;
    }
  }
  return { ...base, data: out };
}

export function StormDesk(props: StormDeskProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setWebgl(!!document.createElement("canvas").getContext("webgl2"));
    } catch {
      setWebgl(false);
    }
  }, []);

  if (webgl === false) {
    // No WebGL2: fall back to the flat 2D engine so the page still works.
    return (
      <div className={cn("rounded-[28px] overflow-hidden", props.className)}>
        <WeatherMap {...props} forceFallback />
      </div>
    );
  }
  if (webgl === null) return <div className={cn("glass min-h-[560px] rounded-[28px]", props.className)} aria-busy />;
  return <StormDeskInner {...props} />;
}

function StormDeskInner({ fund, alerts, clusters, nhcStorms = [], mode = "LIVE", onSelectCluster, onSelectAlert, variant = "desk", focusPoint, className }: StormDeskProps) {
  const hero = variant === "hero";
  const panel = variant === "panel";
  const showHud = variant === "desk";
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const deckRef = useRef<CloudDeckLayer | null>(null);
  const rainRef = useRef<RainLayer | null>(null);
  const windRef = useRef<WindLayer | null>(null);
  const nightRef = useRef<NightLayer | null>(null);
  const framesRef = useRef<Map<string, CompositeFrame>>(new Map());
  const fcFrames = useRef<Map<number, CompositeFrame>>(new Map());
  const radarFieldKey = useRef<string>("");

  const [mapReady, setMapReady] = useState(false);
  const [imagery, setImagery] = useState<ImageryPayload | null>(null);
  const [grid, setGrid] = useState<ForecastGrid | null>(null);
  const [framesVersion, setFramesVersion] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState<string | null>("Loading live satellite…");
  const [now, setNow] = useState(() => new Date());
  const [slider, setSlider] = useState(300);
  const [playing, setPlaying] = useState(false);
  const [preset, setPreset] = useState<CameraPreset | null>(hero ? null : "gulf");
  const [selected, setSelected] = useState<{ kicker: string; title: string; meta: string; tone: "storm" | "money" | "danger" } | null>(null);
  const [active, setActive] = useState<Record<DeskLayerKey, boolean>>({
    clouds: true, radar: true, rain: true, wind: showHud, warnings: true, households: !hero, track: true, night: false,
  });

  const minutes = sliderToMinutes(slider);
  const isReplay = mode === "REPLAY" || mode === "HISTORICAL_REPLAY";

  /* ── data ─────────────────────────────────────────────── */
  useEffect(() => {
    let dead = false;
    const load = async () => {
      const [im, gr] = await Promise.allSettled([
        fetch("/api/sentinel/imagery").then((r) => r.json() as Promise<ImageryPayload>),
        fetch("/api/sentinel/forecast-grid").then((r) => r.json() as Promise<ForecastGrid>),
      ]);
      if (dead) return;
      if (im.status === "fulfilled") setImagery(im.value);
      if (gr.status === "fulfilled") setGrid(gr.value);
      setNow(new Date());
    };
    load();
    const t = window.setInterval(load, 5 * 60_000);
    return () => { dead = true; window.clearInterval(t); };
  }, []);

  // GIBS advertises a "latest" time a few minutes before that frame is actually rendered, so the anchor is
  // discovered by walking back until a frame really has data.
  const advertisedLatest = imagery?.gibs.goesEastIR?.latest;
  const [anchor, setAnchor] = useState<string | null>(null);
  const irFrames = useMemo(
    () => (anchor ? [4, 3, 2, 1, 0].map((k) => new Date(Date.parse(anchor) - k * 30 * 60_000).toISOString().replace(".000Z", "Z")) : []),
    [anchor]
  );
  const latestIR = anchor ?? undefined;

  /* ── map ──────────────────────────────────────────────── */
  useEffect(() => {
    let dead = false;
    let map: any;
    let spin: number | null = null;

    (async () => {
      const ml = await import("maplibre-gl");
      ml.config.WORKER_URL = "/maplibre-gl-worker.mjs";
      if (dead || !host.current) return;

      const start = hero
        ? { center: [-60, 22] as [number, number], zoom: 1.9, pitch: 0, bearing: 0 }
        : panel
        ? { center: [fund.centerLng, fund.centerLat] as [number, number], zoom: 8.3, pitch: 52, bearing: -14 }
        : PRESETS.gulf;
      map = new ml.Map({
        container: host.current,
        style: {
          version: 8,
          projection: { type: "globe" },
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            bluemarble: {
              type: "raster", tileSize: 256, maxzoom: 8,
              tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"],
              attribution: "NASA GIBS",
            },
            esri: {
              type: "raster", tileSize: 256, maxzoom: 17,
              tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              attribution: "© Esri, Maxar, Earthstar Geographics",
            },
          },
          layers: [
            { id: "space", type: "background", paint: { "background-color": "#050507" } },
            { id: "bluemarble", type: "raster", source: "bluemarble", paint: { "raster-saturation": 0.05, "raster-contrast": 0.06 } },
            {
              id: "esri", type: "raster", source: "esri", minzoom: 4.6,
              paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 4.6, 0, 6.2, 1], "raster-saturation": -0.05 },
            },
          ],
        } as any,
        ...start,
        maxPitch: 78,
        attributionControl: { compact: true },
        interactive: !hero,
      });
      mapRef.current = map;
      (window as any).__desk = map;

      map.on("error", (e: any) => {
        const msg = e?.error?.message ?? "";
        if (msg) console.warn("[desk] map:", msg);
      });

      map.on("load", () => {
        if (dead) return;
        try {
          map.setSky({
            "sky-color": "#16294d",
            "horizon-color": "#ff9a5c",
            "fog-color": "#0a0a0c",
            "sky-horizon-blend": 0.55,
            "horizon-fog-blend": 0.5,
            "fog-ground-blend": 0.25,
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4.5, 0.9, 7, 0],
          });
        } catch (e) { console.warn("[desk] setSky", e); }

        // GL effect layers (night shading under the clouds)
        const night = new NightLayer();
        map.addLayer(night);
        nightRef.current = night;
        const deck = new CloudDeckLayer();
        map.addLayer(deck);
        deckRef.current = deck;

        // overlays (GeoJSON)
        const empty = { type: "FeatureCollection", features: [] };
        map.addSource("fund-area", { type: "geojson", data: empty });
        map.addLayer({ id: "fund-area-line", type: "line", source: "fund-area", paint: { "line-color": "#F2C14E", "line-width": 1.4, "line-dasharray": [3, 3], "line-opacity": 0.8 } });
        map.addSource("cone", { type: "geojson", data: empty });
        map.addLayer({ id: "cone-fill", type: "fill", source: "cone", paint: { "fill-color": "#FF4FA3", "fill-opacity": 0.14 } });
        map.addLayer({ id: "cone-line", type: "line", source: "cone", paint: { "line-color": "#FF9CCB", "line-width": 1.4, "line-dasharray": [4, 3] } });
        map.addSource("track", { type: "geojson", data: empty });
        map.addLayer({ id: "track-line", type: "line", source: "track", filter: ["==", ["get", "type"], "TRACK_LINE"], paint: { "line-color": "#FF4FA3", "line-width": 2.6 } });
        map.addLayer({ id: "track-points", type: "circle", source: "track", filter: ["==", ["get", "type"], "TRACK_POINT"], paint: { "circle-color": ["get", "color"], "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
        map.addSource("storms", { type: "geojson", data: empty });
        map.addLayer({ id: "storms-halo", type: "circle", source: "storms", paint: { "circle-color": "#FF4FA3", "circle-opacity": 0.22, "circle-radius": 22, "circle-blur": 0.6 } });
        map.addLayer({ id: "storms-dot", type: "circle", source: "storms", paint: { "circle-color": "#FF4FA3", "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
        map.addSource("warnings", { type: "geojson", data: empty });
        map.addLayer({ id: "warnings-fill", type: "fill", source: "warnings", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.16 } });
        map.addLayer({ id: "warnings-line", type: "line", source: "warnings", paint: { "line-color": ["get", "color"], "line-width": 1.8 } });
        map.addSource("clusters", { type: "geojson", data: empty });
        map.addLayer({ id: "clusters-dot", type: "circle", source: "clusters", paint: { "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["get", "total"], 1, 10, 10, 17], "circle-stroke-width": 2, "circle-stroke-color": "#0A0A0C" } });
        map.addLayer({ id: "clusters-label", type: "symbol", source: "clusters", layout: { "text-field": ["to-string", ["get", "total"]], "text-size": 11, "text-allow-overlap": true, "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"] }, paint: { "text-color": "#0A0A0C" } });

        const wind = new WindLayer();
        map.addLayer(wind);
        windRef.current = wind;
        const rain = new RainLayer();
        map.addLayer(rain);
        rainRef.current = rain;

        map.on("click", "clusters-dot", (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          setSelected({ kicker: p.confirmed > 0 ? "In the hazard zone" : "Outside the hazard zone", title: p.name, meta: `${p.total} households · ${p.confirmed} exposed · ${p.medical} medical-device`, tone: p.confirmed > 0 ? "danger" : "money" });
          const c = (window as any).__deskClusters?.find((x: ExposureCluster) => x.clusterId === p.id);
          if (c) onSelectCluster?.(c);
        });
        map.on("click", "warnings-fill", (e: any) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          setSelected({ kicker: p.office ? `NWS ${p.office}` : "NWS", title: p.event, meta: p.headline, tone: "storm" });
          const a = (window as any).__deskAlerts?.find((x: NormalizedAlert) => x.id === p.id);
          if (a) onSelectAlert?.(a);
        });
        for (const id of ["clusters-dot", "warnings-fill"]) {
          map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
        }

        setMapReady(true);

        if (hero) {
          const tick = () => {
            if (!map || dead) return;
            if (!map.isMoving()) map.jumpTo({ center: [map.getCenter().lng + 0.045, map.getCenter().lat] });
            spin = requestAnimationFrame(tick);
          };
          spin = requestAnimationFrame(tick);
        }
      });
    })();

    return () => {
      dead = true;
      if (spin) cancelAnimationFrame(spin);
      map?.remove();
      mapRef.current = null;
      deckRef.current = null; rainRef.current = null; windRef.current = null; nightRef.current = null;
      setMapReady(false);
    };
    // the map is created once; data flows in through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── satellite frames: find the newest real frame, then load the 2 h loop ── */
  useEffect(() => {
    if (!mapReady || !advertisedLatest) return;
    const ac = new AbortController();
    (async () => {
      setLoadingMsg("Loading live satellite…");
      const start = Date.parse(advertisedLatest);
      let found: string | null = null;
      for (let i = 0; i < 7 && !found; i++) {
        const t = new Date(start - i * 10 * 60_000).toISOString().replace(".000Z", "Z");
        if (framesRef.current.has(t)) { found = t; break; }
        const f = await compositeFrame(t, 1, ac.signal).catch(() => null);
        if (ac.signal.aborted) return;
        if (f) { framesRef.current.set(t, f); found = t; }
      }
      if (!found) { setLoadingMsg("Satellite imagery is not available right now"); return; }
      setAnchor(found);
      setFramesVersion((v) => v + 1);
      const loop = [1, 2, 3, 4].map((k) => new Date(Date.parse(found!) - k * 30 * 60_000).toISOString().replace(".000Z", "Z"));
      let n = 0;
      for (const t of loop) {
        if (framesRef.current.has(t)) { n++; continue; }
        setLoadingMsg(`Loading loop · ${n + 1}/${loop.length}`);
        const f = await compositeFrame(t, 0.5, ac.signal).catch(() => null);
        if (ac.signal.aborted) return;
        if (f) { framesRef.current.set(t, f); n++; setFramesVersion((v) => v + 1); }
      }
      setLoadingMsg(null);
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, advertisedLatest]);

  /* ── apply the timeline position to every layer ───────── */
  const applyTime = useCallback(() => {
    const map = mapRef.current;
    const deck = deckRef.current;
    if (!map || !deck) return;
    const m = minutes;
    const nowMs = now.getTime();

    // --- clouds
    const latest = latestIR ? framesRef.current.get(latestIR) : undefined;
    if (m <= 0) {
      const times = irFrames.map((t) => ({ t, min: (Date.parse(t) - Date.parse(latestIR!)) / 60_000 })).filter((x) => framesRef.current.has(x.t));
      if (times.length) {
        let lo = times[0], hi = times[times.length - 1];
        for (let i = 0; i < times.length - 1; i++) if (m >= times[i].min && m <= times[i + 1].min) { lo = times[i]; hi = times[i + 1]; break; }
        const span = hi.min - lo.min;
        deck.setFrame(0, framesRef.current.get(lo.t)!);
        deck.setFrame(1, framesRef.current.get(hi.t)!);
        deck.mix = span > 0 ? Math.max(0, Math.min(1, (m - lo.min) / span)) : 1;
      }
    } else if (latest && grid && grid.state === "ok") {
      const hf = GRID_PAST_HOURS + (nowMs - Date.parse(grid.hours[0])) / 3_600_000 - GRID_PAST_HOURS + m / 60;
      const h0 = Math.floor(hf), h1 = h0 + 1;
      const get = (h: number) => {
        const c = Math.max(0, Math.min(grid.hours.length - 1, h));
        let f = fcFrames.current.get(c);
        if (!f) {
          const ahead = Math.max(0, c - (nowMs - Date.parse(grid.hours[0])) / 3_600_000);
          f = buildForecastFrame(latest, grid, c, smooth(0, 6, ahead));
          fcFrames.current.set(c, f);
          if (fcFrames.current.size > 8) fcFrames.current.delete(fcFrames.current.keys().next().value as number);
        }
        return f;
      };
      deck.setFrame(0, get(h0));
      deck.setFrame(1, get(h1));
      deck.mix = hf - h0;
    } else if (latest) {
      deck.setFrame(0, latest); deck.setFrame(1, latest); deck.mix = 0;
    }

    // --- radar raster (observed only)
    const radar = imagery?.radar;
    if (radar && !map.getSource("radar")) {
      // created on first real frame so the map never requests placeholder tiles
      map.addSource("radar", { type: "raster", tiles: [radarTileTemplate(radar.host, radar.frames[radar.frames.length - 1].path)], tileSize: 256, maxzoom: RADAR_MAX_ZOOM, attribution: "Radar: RainViewer" });
      map.addLayer({ id: "radar", type: "raster", source: "radar", paint: { "raster-opacity": 0, "raster-fade-duration": 300, "raster-resampling": "linear" } }, "desk-cloud-deck");
      radarFieldKey.current = radar.frames[radar.frames.length - 1].path;
    }
    if (radar && map.getSource("radar")) {
      if (m <= 0 && active.radar) {
        const target = nowMs / 1000 + m * 60;
        let best = radar.frames[0];
        for (const f of radar.frames) if (Math.abs(f.time - target) < Math.abs(best.time - target)) best = f;
        const key = best.path;
        if (radarFieldKey.current !== key) {
          radarFieldKey.current = key;
          map.getSource("radar").setTiles([radarTileTemplate(radar.host, best.path)]);
          RadarField.load(radar.host, best.path).then((rf) => {
            if (radarFieldKey.current === key && rf && rainRef.current) rainRef.current.setSampler(rf);
          });
        }
        map.setPaintProperty("radar", "raster-opacity", 0.82);
      } else {
        map.setPaintProperty("radar", "raster-opacity", 0);
        if (m > 0 && grid && grid.state === "ok") {
          radarFieldKey.current = "";
          const hf = (nowMs - Date.parse(grid.hours[0])) / 3_600_000 + m / 60;
          rainRef.current?.setSampler(forecastPrecipSampler(grid, hf));
        }
      }
    }

    // --- wind
    if (grid && grid.state === "ok" && windRef.current) {
      const hf = (nowMs - Date.parse(grid.hours[0])) / 3_600_000 + m / 60;
      windRef.current.setField(windFieldAt(grid, hf));
    }
  }, [minutes, now, irFrames, latestIR, grid, imagery, active.radar]);

  useEffect(() => {
    if (mapReady) applyTime();
  }, [mapReady, applyTime, framesVersion]);

  /* ── layer visibility ─────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (deckRef.current) { deckRef.current.visible = active.clouds; deckRef.current.nightMix = active.night ? 1 : 0; }
    if (nightRef.current) nightRef.current.visible = active.night;
    if (rainRef.current) rainRef.current.visible = active.rain;
    if (windRef.current) windRef.current.visible = active.wind;
    const vis = (ids: string[], on: boolean) => ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    vis(["warnings-fill", "warnings-line"], active.warnings);
    vis(["clusters-dot", "clusters-label"], active.households);
    vis(["cone-fill", "cone-line", "track-line", "track-points"], active.track && isReplay);
    vis(["storms-halo", "storms-dot"], active.track);
    if (!active.radar && map.getLayer("radar")) map.setPaintProperty("radar", "raster-opacity", 0);
    map.triggerRepaint();
  }, [mapReady, active, isReplay]);

  /* ── overlay data ─────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    (window as any).__deskAlerts = alerts;
    (window as any).__deskClusters = clusters?.clusters ?? [];
    const fc = (features: any[]) => ({ type: "FeatureCollection", features });

    map.getSource("warnings")?.setData(
      fc(alerts.filter((a) => a.geometry?.coordinates).map((a) => ({
        type: "Feature", geometry: a.geometry,
        properties: { id: a.id, event: a.event, headline: a.headline, office: a.office, color: hazardColor(a) },
      })))
    );
    map.getSource("clusters")?.setData(
      fc((clusters?.clusters ?? []).map((c) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [c.centroid.lng, c.centroid.lat] },
        properties: {
          id: c.clusterId, name: c.clusterName, total: c.totalHouseholds, confirmed: c.confirmedExposedCount, medical: c.medicalDeviceCount,
          color: c.confirmedExposedCount > 0 ? (c.medicalDeviceCount > 0 ? "#FF3B4E" : "#FFB020") : "#6FD49A",
        },
      })))
    );
    const [w, s, e, n] = fund.bounds;
    map.getSource("fund-area")?.setData(fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } }]));
    map.getSource("storms")?.setData(
      fc(nhcStorms.map((st) => ({ type: "Feature", geometry: { type: "Point", coordinates: [st.lng, st.lat] }, properties: { name: st.name } })))
    );
    // Milton's track and cone are 2024 replay data: only drawn in replay mode
    map.getSource("cone")?.setData(isReplay ? (MILTON_CONE_OF_UNCERTAINTY_GEOJSON as any) : fc([]));
    map.getSource("track")?.setData(isReplay ? (getMiltonTrackGeoJSON() as any) : fc([]));
  }, [mapReady, alerts, clusters, fund, nhcStorms, isReplay]);

  /* ── focus point from the outside (e.g. a selected case in the grid) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !focusPoint) return;
    map.flyTo({ center: [focusPoint.lng, focusPoint.lat], zoom: focusPoint.zoom ?? 9.2, pitch: 55, bearing: -16, duration: 1800, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusPoint?.lng, focusPoint?.lat, focusPoint?.key]);

  /* ── camera presets ───────────────────────────────────── */
  const goPreset = (p: CameraPreset) => {
    setPreset(p);
    const cfg = PRESETS[p];
    mapRef.current?.flyTo({ ...cfg, duration: 2600, essential: true, curve: 1.5 });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const onMoveEnd = () => rainRef.current?.reseed();
    map.on("moveend", onMoveEnd);
    return () => map.off("moveend", onMoveEnd);
  }, [mapReady]);

  /* ── play loop ────────────────────────────────────────── */
  useEffect(() => {
    if (!playing) return;
    const s = { v: slider >= 995 ? 0 : slider };
    const tw = gsap.to(s, {
      v: 1000,
      duration: ((1000 - s.v) / 1000) * 26,
      ease: "none",
      onUpdate: () => setSlider(s.v),
      onComplete: () => setPlaying(false),
    });
    return () => { tw.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /* ── labels ───────────────────────────────────────────── */
  const segmentKind: "observed" | "forecast" = minutes > 0.5 ? "forecast" : "observed";
  const satLabel = latestIR ? `${new Date(latestIR).toISOString().slice(11, 16)} UTC` : "—";
  const segmentLabel =
    segmentKind === "observed"
      ? `GOES-East / West / Himawari IR · latest ${satLabel} · RainViewer radar`
      : grid?.state === "ok"
      ? "Open-Meteo model guidance · wind, clouds and rain · satellite frozen outside the model area"
      : "Forecast unavailable";

  const storm = nhcStorms[0];
  const crawl: CrawlItem[] = useMemo(
    () =>
      alerts.slice(0, 12).map((a) => ({
        id: a.id,
        label: isReplay ? "Replay · NWS" : "NWS",
        tone: a.significance === "W" ? ("danger" as const) : ("amber" as const),
        text: a.headline,
      })),
    [alerts, isReplay]
  );

  const stateTag =
    isReplay ? <Tag tone="storm" solid>Replay · Oct 2024</Tag>
    : mode === "STALE" ? <Tag tone="amber" solid>Stale feed</Tag>
    : mode === "ERROR" ? <Tag tone="danger" solid>Feed error</Tag>
    : <Tag tone="accent" solid live>Live</Tag>;

  const feed = (label: string, ok: boolean, detail?: string) => (
    <Tag tone={ok ? "delivered" : "danger"} title={detail}>{label}{ok ? "" : " · unavailable"}</Tag>
  );

  const hasRadar = !!imagery?.radar;
  const hasModel = grid?.state === "ok";

  return (
    <section className={cn("relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-black", panel && "h-full", className)} aria-label="Live weather globe">
      <div className={cn("relative", hero ? "h-full min-h-[480px]" : panel ? "h-full min-h-[420px]" : "h-[80vh] min-h-[620px]")}>
        <div className="absolute inset-0">
          <div ref={host} style={{ width: "100%", height: "100%" }} />
        </div>

        {showHud && (
          <>
            {/* top-left: on-air storm headline + feed health */}
            <div className="pointer-events-none absolute left-4 top-4 flex max-w-[min(470px,calc(100%-2rem))] flex-col items-start gap-2.5 xl:max-w-[min(520px,45%)]">
              <div className="pointer-events-auto">
                {isReplay ? (
                  <LowerThird kicker="Replay · Oct 2024" title="Hurricane Milton" meta="Cat 4 · Tampa Bay landfall in ~12 h · NHC archive" tone="storm" icon={<I.stormEye className="h-4 w-4" />} />
                ) : storm ? (
                  <LowerThird kicker="Tropical cyclone" title={`${storm.classification} ${storm.name}`} meta={`${storm.intensityKt} kt · ${storm.pressureMb} mb · moving ${storm.movementDir}° at ${storm.movementSpeedKt} kt · NHC`} tone="storm" icon={<I.stormEye className="h-4 w-4" />} />
                ) : (
                  <LowerThird kicker="All clear" title="No active Atlantic storm" meta="Live satellite, radar and model winds · NHC, NWS, NASA, Open-Meteo" tone="delivered" icon={<I.broadcast className="h-4 w-4" />} />
                )}
              </div>
              <div className="pointer-events-auto glass-hud flex flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1.5">
                {stateTag}
                {feed(`Satellite ${satLabel}`, !!latestIR, imagery?.errors.join("; "))}
                {feed("Radar", hasRadar)}
                {feed("Model", hasModel, grid?.error)}
              </div>
            </div>

            {/* top-right: layers */}
            <div className="absolute right-4 top-4 hidden max-w-[min(500px,46%)] justify-end md:flex">
              <LayerChips
                active={active}
                onToggle={(k) => setActive((a) => ({ ...a, [k]: !a[k] }))}
                available={{ radar: hasRadar, rain: hasRadar || hasModel, wind: hasModel, clouds: !!latestIR }}
              />
            </div>

            {/* selection */}
            {selected && (
              <div className="absolute bottom-[8.5rem] left-4 max-w-[min(460px,calc(100%-2rem))]">
                <LowerThird kicker={selected.kicker} title={selected.title} meta={selected.meta} tone={selected.tone} right={
                  <button className="rounded-full p-1.5 text-ink-3 hover:bg-white/10 hover:text-ink" aria-label="Dismiss" onClick={() => setSelected(null)}><I.close className="h-4 w-4" /></button>
                } />
              </div>
            )}

            {/* bottom: legends, presets, timeline */}
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-end justify-between gap-2.5">
                <div className="pointer-events-auto"><Legends show={{ radar: active.radar && hasRadar, clouds: active.clouds, wind: active.wind && hasModel }} /></div>
                <div className="pointer-events-auto"><CameraPresets value={preset} onChange={goPreset} /></div>
              </div>
              <div className="pointer-events-auto">
                <Timeline
                  slider={slider}
                  minutes={minutes}
                  playing={playing}
                  onSlider={(s) => { setPlaying(false); setSlider(s); }}
                  onPlay={() => setPlaying((p) => !p)}
                  segmentLabel={segmentLabel}
                  segmentKind={segmentKind}
                  loading={loadingMsg}
                  now={now}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {showHud && (
        <div className="border-t border-white/[0.08] bg-black/40 px-4 py-2.5">
          {crawl.length > 0 ? (
            <NewsCrawl items={crawl} label="Active NWS alerts" />
          ) : (
            <p className="text-[12.5px] text-ink-3">No active NWS warnings for {fund.name}. The globe is showing live satellite, radar and model data.</p>
          )}
          <p className="mt-1.5 font-mono text-[10.5px] tracking-[0.04em] text-ink-3">
            Satellite: NASA GIBS (GOES-East, GOES-West, Himawari) · Radar: RainViewer · Model: Open-Meteo · Warnings: NWS · Storms: NHC
          </p>
        </div>
      )}
    </section>
  );
}
