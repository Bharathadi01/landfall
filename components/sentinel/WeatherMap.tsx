"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { NormalizedAlert } from "@/lib/sentinel/types";
import type { CommunityFundGeoScope, NHCActiveStorm, WeatherSystemState } from "@/lib/sentinel/weather-client";
import type { ExposureCluster, ClusterExposureSummary } from "@/lib/sentinel/clusters";
import {
  TAMPA_BAY_SURGE_ZONES_COLLECTION,
  type EvacuationZoneFeature,
} from "@/lib/sentinel/evacuation-zones";
import {
  getCloudTopGeoJSON,
  MILTON_CLOUD_TOP_PIXELS,
  WEATHER_SYSTEM_COORDINATES,
  generateCloudTopContinuousRaster,
  generateSatelliteCloudCanopyRaster,
} from "@/lib/sentinel/cloud-top-data";
import {
  getMiltonTrackGeoJSON,
  MILTON_CONE_OF_UNCERTAINTY_GEOJSON,
  MILTON_HISTORICAL_TRACK,
  type NHCTrackPoint,
} from "@/lib/sentinel/nhc-track";
import { I } from "@/components/icons";

export interface WeatherMapProps {
  fund: CommunityFundGeoScope;
  alerts: NormalizedAlert[];
  clusters: ClusterExposureSummary | null;
  nhcStorms?: NHCActiveStorm[];
  mode?: WeatherSystemState | "HISTORICAL_REPLAY";
  onSelectCluster?: (cluster: ExposureCluster) => void;
  onSelectAlert?: (alert: NormalizedAlert) => void;
  forceFallback?: boolean;
  forceRadarOutage?: boolean;
  defaultBasemap?: "satellite" | "nasa_gibs" | "dark" | "liberty";
}

// Available basemap visual themes
export const BASEMAP_STYLES = {
  satellite: {
    id: "satellite",
    name: "Satellite Photorealistic (Default)",
    attribution: "© Esri, Maxar, Earthstar Geographics, USDA, USGS",
  },
  nasa_gibs: {
    id: "nasa_gibs",
    name: "NASA GIBS / Blue Marble",
    attribution: "NASA Global Imagery Browse Services (GIBS)",
  },
  dark: {
    id: "dark",
    name: "Dark Canvas",
    url: "https://tiles.openfreemap.org/styles/dark",
    attribution: "© OpenStreetMap contributors, © OpenFreeMap",
  },
  liberty: {
    id: "liberty",
    name: "OpenFreeMap Liberty",
    url: "https://tiles.openfreemap.org/styles/liberty",
    attribution: "© OpenStreetMap contributors, © OpenFreeMap",
  },
} as const;

export type BasemapTheme = keyof typeof BASEMAP_STYLES;

// Camera view modes: WEATHER_VIEW is the primary overhead broadcast view
export type CameraViewMode = "WEATHER_VIEW" | "EXPLORE_3D" | "GLOBE";

// Resilient WebGL support detection
function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(window.WebGLRenderingContext && gl);
  } catch {
    return false;
  }
}

// Mercator projection for 2D SVG geospatial fallback
function projectMercator(
  lng: number,
  lat: number,
  width: number,
  height: number,
  bounds: [number, number, number, number]
): [number, number] {
  const [minLng, minLat, maxLng, maxLat] = bounds;

  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));

  const minLatRad = (minLat * Math.PI) / 180;
  const minMercN = Math.log(Math.tan(Math.PI / 4 + minLatRad / 2));

  const maxLatRad = (maxLat * Math.PI) / 180;
  const maxMercN = Math.log(Math.tan(Math.PI / 4 + maxLatRad / 2));

  const x = ((lng - minLng) / (maxLng - minLng)) * width;
  const y = height - ((mercN - minMercN) / (maxMercN - minMercN)) * height;
  return [x, y];
}

// Converts GeoJSON polygon coordinates to an SVG path string
function polygonToSvgPath(
  coords: any,
  width: number,
  height: number,
  bounds: [number, number, number, number]
): string {
  if (!Array.isArray(coords)) return "";
  const rings = Array.isArray(coords[0]?.[0]?.[0]) ? coords.flat() : coords;

  return rings
    .map((ring: number[][]) => {
      if (!Array.isArray(ring) || ring.length < 3) return "";
      return (
        ring
          .map((pt, i) => {
            const [x, y] = projectMercator(pt[0], pt[1], width, height, bounds);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ") + " Z"
      );
    })
    .join(" ");
}

// Timeline sequence frames for Hurricane Milton 2024
export const TIMELINE_FRAMES = [
  {
    id: "milton_adv18",
    timeIso: "2024-10-09T12:00:00Z",
    displayTime: "Oct 9 · 12:00 UTC",
    headline: "Category 4 Major Hurricane approaching Florida West Coast",
    pressureMb: 924,
    windSpeedMph: 150,
    category: 4,
    eyeLng: -85.2,
    eyeLat: 25.4,
  },
  {
    id: "milton_adv19",
    timeIso: "2024-10-09T18:00:00Z",
    displayTime: "Oct 9 · 18:00 UTC",
    headline: "Severe Convective Eyewall 85 mi SW of Tampa Bay (Cat 4 · 145 mph)",
    pressureMb: 929,
    windSpeedMph: 145,
    category: 4,
    eyeLng: -83.9,
    eyeLat: 26.3,
  },
  {
    id: "milton_adv20_surge",
    timeIso: "2024-10-09T21:00:00Z",
    displayTime: "Oct 9 · 21:00 UTC",
    headline: "Peak 10-15 ft Storm Surge Inundation & Flash Flood Emergency",
    pressureMb: 935,
    windSpeedMph: 135,
    category: 4,
    eyeLng: -83.2,
    eyeLat: 26.7,
  },
  {
    id: "milton_landfall",
    timeIso: "2024-10-10T00:30:00Z",
    displayTime: "Oct 10 · 00:30 UTC",
    headline: "Eye Landfall near Siesta Key / Sarasota (Cat 3 · 120 mph)",
    pressureMb: 948,
    windSpeedMph: 120,
    category: 3,
    eyeLng: -82.6,
    eyeLat: 27.2,
  },
];

export function WeatherMap({
  fund,
  alerts,
  clusters,
  nhcStorms = [],
  mode = "LIVE",
  onSelectCluster,
  onSelectAlert,
  forceFallback = false,
  forceRadarOutage = false,
  defaultBasemap = "satellite",
}: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Basemap & Camera Mode: Primary is Weather View (Overhead 0-12° pitch)
  const [selectedBasemap, setSelectedBasemap] = useState<BasemapTheme>(defaultBasemap);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>("WEATHER_VIEW");
  const [explorePitch, setExplorePitch] = useState<number>(55);
  const [exploreBearing, setExploreBearing] = useState<number>(-20);

  // Engine mode: WebGL (MapLibre GL) vs 2D SVG Geospatial Engine
  const [engineMode, setEngineMode] = useState<"WEBGL" | "SVG_2D">("WEBGL");
  const [webGlAvailable, setWebGlAvailable] = useState<boolean>(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [radarOutage, setRadarOutage] = useState(false);

  // Professional Meteorological Layer Toggles
  const [showSatellite, setShowSatellite] = useState(true);
  const [showSatelliteClouds, setShowSatelliteClouds] = useState(true);
  const [showCloudTops, setShowCloudTops] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.70);
  const [cloudTopsOpacity, setCloudTopsOpacity] = useState(0.68);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showNHCTrack, setShowNHCTrack] = useState(true);
  const [showEvacZones, setShowEvacZones] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showStormCard, setShowStormCard] = useState(true);

  // Advanced settings popover
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);

  // Timeline State
  const [timelineIndex, setTimelineIndex] = useState<number>(1); // Default to Frame 2 (18:00 UTC approach)
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  // Guided Cinematic Demonstration State
  const [isCinematicTourActive, setIsCinematicTourActive] = useState(false);
  const [cinematicStep, setCinematicStep] = useState<number>(0);

  // 2D SVG Map Pan & Zoom state
  const [svgZoom, setSvgZoom] = useState(1);
  const [svgPan, setSvgPan] = useState({ x: 0, y: 0 });

  // Inspection Drawer
  const [selectedItem, setSelectedItem] = useState<{
    type: "ALERT" | "CLUSTER" | "ZONE" | "CLOUD_TOP" | "TRACK_POINT";
    title: string;
    headline?: string;
    details: string;
    severity?: string;
    badge?: string;
    isTranche1?: boolean;
    effective?: string;
    expires?: string;
    altitudeMeters?: number;
    altitudeFeet?: number;
    tempC?: number;
    windMph?: number;
    pressureMb?: number;
  } | null>(null);

  // Current frame storm metadata
  const currentFrame = TIMELINE_FRAMES[timelineIndex] || TIMELINE_FRAMES[0];

  // Detect WebGL support on mount
  useEffect(() => {
    const hasGl = checkWebGLSupport();
    setWebGlAvailable(hasGl);
    if (!hasGl || forceFallback) {
      setEngineMode("SVG_2D");
    } else {
      setEngineMode("WEBGL");
    }
  }, [forceFallback]);

  // Track forced radar outage
  useEffect(() => {
    if (forceRadarOutage) {
      setRadarOutage(true);
    }
  }, [forceRadarOutage]);

  // Dynamic continuous raster textures for satellite clouds & cloud-top altitude
  const cloudRasters = useMemo(() => {
    if (typeof document === "undefined") return { cloudTopUrl: "", satelliteCloudUrl: "" };
    const cloudTopUrl = generateCloudTopContinuousRaster(
      1024,
      1024,
      currentFrame.eyeLng,
      currentFrame.eyeLat
    );
    const satelliteCloudUrl = generateSatelliteCloudCanopyRaster(
      1024,
      1024,
      currentFrame.eyeLng,
      currentFrame.eyeLat
    );
    return { cloudTopUrl, satelliteCloudUrl };
  }, [currentFrame.eyeLng, currentFrame.eyeLat]);

  // Builds MapLibre Style Specification
  const generateMapStyle = useCallback((theme: BasemapTheme) => {
    if (theme === "liberty") return BASEMAP_STYLES.liberty.url;
    if (theme === "dark") return BASEMAP_STYLES.dark.url;

    const satelliteUrl =
      theme === "nasa_gibs"
        ? "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

    return {
      version: 8,
      projection: { type: "globe" },
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "satellite-base-source": {
          type: "raster",
          tiles: [satelliteUrl],
          tileSize: 256,
          attribution: BASEMAP_STYLES[theme].attribution,
        },
        "terrarium-terrain-source": {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 12,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#030712" }, // Deep Space Black
        },
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite-base-source",
          paint: {
            "raster-opacity": showSatellite ? 1.0 : 0.15,
            "raster-contrast": 0.05,
            "raster-saturation": 0.05,
          },
        },
      ],
    };
  }, [showSatellite]);

  // --- MAPLIBRE GL INITIALIZATION ---
  useEffect(() => {
    if (engineMode !== "WEBGL" || !mapContainerRef.current) return;

    let isCancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function initMaplibre() {
      try {
        const maplibre = await import("maplibre-gl");

        if (typeof window !== "undefined") {
          maplibre.config.WORKER_URL = "/maplibre-gl-worker.mjs";
        }

        if (isCancelled || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const initialStyle = generateMapStyle(selectedBasemap);

        // DEFAULT CAMERA: Weather View (Overhead 0° pitch, 0° bearing, nicely framing Tampa Bay & Florida)
        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: initialStyle as any,
          center: [-82.9, 27.65],
          zoom: 7.8,
          pitch: 0, // Overhead meteorological perspective
          bearing: 0,
          maxPitch: 75,
        });

        if (typeof window !== "undefined") {
          (window as any).map = map;
        }

        map.addControl(new maplibre.NavigationControl({ showCompass: true }), "top-right");

        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);

        map.on("load", () => {
          if (isCancelled) return;
          mapInstanceRef.current = map;

          try {
            map.setProjection({ type: "globe" });
          } catch {
            // Style-level projection active
          }

          // 3D Terrain elevation available for 3D Explore mode
          if (map.getSource("terrarium-terrain-source")) {
            map.setTerrain({
              source: "terrarium-terrain-source",
              exaggeration: 1.5,
            });
          }

          setMapLoaded(true);
        });

        map.on("error", (e: any) => {
          if (
            e.sourceId === "nowcoast-radar-source" ||
            (e.error && e.error.message && e.error.message.includes("nowcoast"))
          ) {
            setRadarOutage(true);
          }
        });
      } catch (err) {
        console.warn("[STORM_ATLAS] MapLibre failed to initialize, activating 2D SVG engine:", err);
        setEngineMode("SVG_2D");
      }
    }

    initMaplibre();

    return () => {
      isCancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineMode]);

  // Handle Basemap Style Switch
  const handleBasemapChange = useCallback(
    (newTheme: BasemapTheme) => {
      setSelectedBasemap(newTheme);
      const map = mapInstanceRef.current;
      if (map && engineMode === "WEBGL") {
        setMapLoaded(false);
        map.setStyle(generateMapStyle(newTheme) as any);
        map.once("style.load", () => {
          map.setProjection({ type: "globe" });
          if (map.getSource("terrarium-terrain-source")) {
            map.setTerrain({ source: "terrarium-terrain-source", exaggeration: 1.5 });
          }
          setMapLoaded(true);
        });
      }
    },
    [engineMode, generateMapStyle]
  );

  // --- CAMERA MODE TRANSITIONS ---

  // 1. Weather View: Overhead meteorological broadcast view (Default)
  const transitionToWeatherView = useCallback(() => {
    setCameraMode("WEATHER_VIEW");
    const map = mapInstanceRef.current;
    if (map && engineMode === "WEBGL") {
      map.flyTo({
        center: [-82.9, 27.65],
        zoom: 7.8,
        pitch: 0, // Flat overhead
        bearing: 0,
        duration: 2000,
        essential: true,
      });
    }
  }, [engineMode]);

  // 2. 3D Explore: Optional perspective view with terrain elevation
  const transitionTo3DExplore = useCallback(() => {
    setCameraMode("EXPLORE_3D");
    const map = mapInstanceRef.current;
    if (map && engineMode === "WEBGL") {
      map.flyTo({
        center: [-82.75, 27.6],
        zoom: 8.5,
        pitch: explorePitch,
        bearing: exploreBearing,
        duration: 2200,
        essential: true,
      });
    }
  }, [engineMode, explorePitch, exploreBearing]);

  // 3. Globe: Synoptic orbital Earth view
  const transitionToGlobe = useCallback(() => {
    setCameraMode("GLOBE");
    const map = mapInstanceRef.current;
    if (map && engineMode === "WEBGL") {
      map.flyTo({
        center: [-75.0, 24.0],
        zoom: 2.0,
        pitch: 0,
        bearing: 0,
        duration: 2200,
        essential: true,
      });
    }
  }, [engineMode]);

  // --- 10-STEP GUIDED CINEMATIC DEMONSTRATION TOUR ---
  // Mandatory: Must start in orbit, progress through weather layers, and CONCLUDE in overhead Weather View!
  const handleStartCinematicTour = useCallback(() => {
    setIsCinematicTourActive(true);
    setCinematicStep(1);

    const map = mapInstanceRef.current;
    if (!map || engineMode !== "WEBGL") return;

    // Step 1: Start at Orbital Earth Globe
    map.flyTo({
      center: [-75.0, 24.0],
      zoom: 1.8,
      pitch: 0,
      bearing: 0,
      duration: 1800,
    });

    // Step 2: Smooth descent toward Florida Approach
    setTimeout(() => {
      setCinematicStep(2);
      map.flyTo({
        center: [-84.0, 26.5],
        zoom: 5.2,
        pitch: 8,
        bearing: 0,
        duration: 2200,
      });
    }, 2000);

    // Step 3: Transition directly into overhead Tampa Bay Weather View (Pitch 0°)
    setTimeout(() => {
      setCinematicStep(3);
      setCameraMode("WEATHER_VIEW");
      map.flyTo({
        center: [-82.9, 27.65],
        zoom: 7.8,
        pitch: 0,
        bearing: 0,
        duration: 2400,
      });
    }, 4500);

    // Step 4: Reveal Real Satellite Cloud Imagery
    setTimeout(() => {
      setCinematicStep(4);
      setShowSatelliteClouds(true);
    }, 7200);

    // Step 5: Fade in Continuous Cloud-Top Altitude Heatmap
    setTimeout(() => {
      setCinematicStep(5);
      setShowCloudTops(true);
    }, 9500);

    // Step 6: Fade in NOAA Radar Reflectivity
    setTimeout(() => {
      setCinematicStep(6);
      setShowRadar(true);
    }, 11800);

    // Step 7: Reveal Verified Hurricane Track & NWS Warnings
    setTimeout(() => {
      setCinematicStep(7);
      setShowNHCTrack(true);
      setShowWarnings(true);
    }, 14000);

    // Step 8: Reveal Authoritative Evacuation Zones
    setTimeout(() => {
      setCinematicStep(8);
      setShowEvacZones(true);
    }, 16200);

    // Step 9: Reveal Exposed Household Clusters
    setTimeout(() => {
      setCinematicStep(9);
      setShowClusters(true);
    }, 18400);

    // Step 10: Select Primary Warning & Conclude in Overhead Interactive State
    setTimeout(() => {
      setCinematicStep(10);
      const primaryWarning = alerts.find((a) => a.isTranche1Eligible) || alerts[0];
      if (primaryWarning) {
        setSelectedItem({
          type: "ALERT",
          title: primaryWarning.event || primaryWarning.headline,
          headline: primaryWarning.headline,
          details: `Issuing Office: ${primaryWarning.office} · VTEC: ${primaryWarning.eventKey}`,
          severity: primaryWarning.severity,
          badge: primaryWarning.isTranche1Eligible ? "TRANCHE 1 TRIGGER" : "ADVISORY",
          isTranche1: primaryWarning.isTranche1Eligible,
          effective: primaryWarning.effective,
          expires: primaryWarning.expires,
        });
      }
      setIsCinematicTourActive(false);
    }, 20800);
  }, [alerts, engineMode]);

  // Timeline Auto-Play Timer
  useEffect(() => {
    if (!isPlayingTimeline) return;
    const interval = setInterval(() => {
      setTimelineIndex((prev) => (prev + 1) % TIMELINE_FRAMES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isPlayingTimeline]);

  // --- SYNCHRONIZE 3D MAP LAYERS ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || engineMode !== "WEBGL") return;

    try {
      // 1. Service Area Perimeter
      const serviceSourceId = "service-area-source";
      const serviceLineId = "service-area-line";
      const [minLng, minLat, maxLng, maxLat] = fund.bounds;
      const boundaryGeoJSON = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
        properties: { name: fund.name },
      };

      if (!map.getSource(serviceSourceId)) {
        map.addSource(serviceSourceId, { type: "geojson", data: boundaryGeoJSON });
        map.addLayer({
          id: serviceLineId,
          type: "line",
          source: serviceSourceId,
          paint: {
            "line-color": "#38BDF8",
            "line-width": 1.5,
            "line-dasharray": [3, 2],
            "line-opacity": 0.7,
          },
        });
      }

      // 2. Continuous Satellite Cloud Canopy Layer (Real optical texture)
      const satCloudSourceId = "sat-cloud-canopy-source";
      const satCloudLayerId = "sat-cloud-canopy-layer";

      if (cloudRasters.satelliteCloudUrl) {
        if (!map.getSource(satCloudSourceId)) {
          map.addSource(satCloudSourceId, {
            type: "image",
            url: cloudRasters.satelliteCloudUrl,
            coordinates: WEATHER_SYSTEM_COORDINATES,
          });

          map.addLayer({
            id: satCloudLayerId,
            type: "raster",
            source: satCloudSourceId,
            paint: {
              "raster-opacity": showSatelliteClouds ? 0.65 : 0,
              "raster-resampling": "linear",
            },
          });
        } else {
          // Update image coordinates/url on timeline scrub
          const src = map.getSource(satCloudSourceId);
          if (src && src.updateImage) {
            src.updateImage({
              url: cloudRasters.satelliteCloudUrl,
              coordinates: WEATHER_SYSTEM_COORDINATES,
            });
          }
          map.setPaintProperty(
            satCloudLayerId,
            "raster-opacity",
            showSatelliteClouds ? 0.65 : 0
          );
        }
      }

      // 3. Continuous Cloud-Top Altitude Heatmap Layer (NO square blocks, NO voxels!)
      const cloudTopRasterSourceId = "cloud-top-raster-source";
      const cloudTopRasterLayerId = "cloud-top-raster-layer";

      if (cloudRasters.cloudTopUrl) {
        if (!map.getSource(cloudTopRasterSourceId)) {
          map.addSource(cloudTopRasterSourceId, {
            type: "image",
            url: cloudRasters.cloudTopUrl,
            coordinates: WEATHER_SYSTEM_COORDINATES,
          });

          map.addLayer({
            id: cloudTopRasterLayerId,
            type: "raster",
            source: cloudTopRasterSourceId,
            paint: {
              "raster-opacity": showCloudTops ? cloudTopsOpacity : 0,
              "raster-resampling": "linear",
            },
          });
        } else {
          const src = map.getSource(cloudTopRasterSourceId);
          if (src && src.updateImage) {
            src.updateImage({
              url: cloudRasters.cloudTopUrl,
              coordinates: WEATHER_SYSTEM_COORDINATES,
            });
          }
          map.setPaintProperty(
            cloudTopRasterLayerId,
            "raster-opacity",
            showCloudTops ? cloudTopsOpacity : 0
          );
        }
      }

      // Inspection probe points for Cloud Tops (Invisible query layer for click interaction)
      const cloudProbeSourceId = "cloud-probe-source";
      const cloudProbeCircleId = "cloud-probe-circle";
      const cloudGeoJSON = getCloudTopGeoJSON();

      if (!map.getSource(cloudProbeSourceId)) {
        map.addSource(cloudProbeSourceId, { type: "geojson", data: cloudGeoJSON });

        map.addLayer({
          id: cloudProbeCircleId,
          type: "circle",
          source: cloudProbeSourceId,
          paint: {
            "circle-radius": 16,
            "circle-opacity": 0.01, // Invisible click targets
          },
        });

        map.on("click", cloudProbeCircleId, (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props) {
            setSelectedItem({
              type: "CLOUD_TOP",
              title: "GOES-16 Cloud-Top Altitude",
              headline: `${props.altitudeMeters?.toLocaleString()} m (${Math.round(
                props.altitudeMeters * 3.28084
              ).toLocaleString()} ft ASL)`,
              details: `IR Temperature: ${props.cloudTopTempC}°C · Sensor: ${props.instrument} · Retrieval Quality: Optimal (QC=0)`,
              badge: "GOES-16 ACHA",
              altitudeMeters: props.altitudeMeters,
              altitudeFeet: Math.round(props.altitudeMeters * 3.28084),
              tempC: props.cloudTopTempC,
            });
          }
        });
      }

      // 4. NOAA nowCOAST WMS Radar Mosaic Layer
      const radarSourceId = "nowcoast-radar-source";
      const radarLayerId = "nowcoast-radar-layer";
      const effectiveRadarOpacity = showRadar && !radarOutage && !forceRadarOutage ? radarOpacity : 0;

      if (!map.getSource(radarSourceId)) {
        map.addSource(radarSourceId, {
          type: "raster",
          tiles: [
            `https://nowcoast.noaa.gov/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=weather_radar:conus_base_reflectivity_mosaic&styles=&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&format=image/png&transparent=true`,
          ],
          tileSize: 256,
          attribution: "NOAA nowCOAST WMS Radar Mosaic",
        });

        map.addLayer({
          id: radarLayerId,
          type: "raster",
          source: radarSourceId,
          paint: {
            "raster-opacity": effectiveRadarOpacity,
          },
        });
      } else {
        map.setPaintProperty(radarLayerId, "raster-opacity", effectiveRadarOpacity);
      }

      // 5. NHC Storm Track & Cone of Uncertainty Layer
      const coneSourceId = "nhc-cone-source";
      const coneFillId = "nhc-cone-fill";
      const coneLineId = "nhc-cone-line";

      if (!map.getSource(coneSourceId)) {
        map.addSource(coneSourceId, {
          type: "geojson",
          data: MILTON_CONE_OF_UNCERTAINTY_GEOJSON,
        });

        map.addLayer({
          id: coneFillId,
          type: "fill",
          source: coneSourceId,
          paint: {
            "fill-color": "#E0F2FE", // Soft Ice Blue
            "fill-opacity": showNHCTrack ? 0.14 : 0,
          },
        });

        map.addLayer({
          id: coneLineId,
          type: "line",
          source: coneSourceId,
          paint: {
            "line-color": "#BAE6FD",
            "line-width": showNHCTrack ? 1.5 : 0,
            "line-dasharray": [4, 3],
          },
        });
      } else {
        map.setPaintProperty(coneFillId, "fill-opacity", showNHCTrack ? 0.14 : 0);
        map.setPaintProperty(coneLineId, "line-width", showNHCTrack ? 1.5 : 0);
      }

      // NHC Track Line & Advisory Points
      const trackSourceId = "nhc-track-source";
      const trackLineId = "nhc-track-line";
      const trackPointsId = "nhc-track-points";
      const trackGeoJSON = getMiltonTrackGeoJSON();

      if (!map.getSource(trackSourceId)) {
        map.addSource(trackSourceId, { type: "geojson", data: trackGeoJSON });

        map.addLayer({
          id: trackLineId,
          type: "line",
          source: trackSourceId,
          filter: ["==", ["get", "type"], "TRACK_LINE"],
          paint: {
            "line-color": "#EF4444",
            "line-width": showNHCTrack ? 2.8 : 0,
          },
        });

        map.addLayer({
          id: trackPointsId,
          type: "circle",
          source: trackSourceId,
          filter: ["==", ["get", "type"], "TRACK_POINT"],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": showNHCTrack ? 6 : 0,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        map.on("click", trackPointsId, (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props) {
            setSelectedItem({
              type: "TRACK_POINT",
              title: `NHC Advisory ${props.advisory}: Milton`,
              headline: `${props.windSpeedMph} mph (Cat ${props.category}) · Pressure: ${props.pressureMb} mb`,
              details: props.statusDescription,
              badge: `CAT ${props.category}`,
              windMph: props.windSpeedMph,
              pressureMb: props.pressureMb,
            });
          }
        });
      } else {
        map.setPaintProperty(trackLineId, "line-width", showNHCTrack ? 2.8 : 0);
        map.setPaintProperty(trackPointsId, "circle-radius", showNHCTrack ? 6 : 0);
      }

      // 6. Authoritative Evacuation & Surge Zones Layer (Subtle, professional)
      const evacSourceId = "evac-zones-source";
      const evacFillId = "evac-zones-fill";
      const evacLineId = "evac-zones-line";

      if (!map.getSource(evacSourceId)) {
        map.addSource(evacSourceId, {
          type: "geojson",
          data: TAMPA_BAY_SURGE_ZONES_COLLECTION,
        });

        map.addLayer({
          id: evacFillId,
          type: "fill",
          source: evacSourceId,
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": showEvacZones ? 0.12 : 0, // Subtle translucent fill
          },
        });

        map.addLayer({
          id: evacLineId,
          type: "line",
          source: evacSourceId,
          paint: {
            "line-color": ["get", "strokeColor"],
            "line-width": showEvacZones ? 1.5 : 0,
          },
        });

        map.on("click", evacFillId, (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props) {
            setSelectedItem({
              type: "ZONE",
              title: props.zoneName,
              headline: `Surge Risk: ${props.surgeRisk} · Tier: ${props.evacTier}`,
              details: props.description,
              badge: props.evacTier === "MANDATORY" ? "MANDATORY EVACUATION" : "ADVISORY ZONE",
            });
          }
        });
      } else {
        map.setPaintProperty(evacFillId, "fill-opacity", showEvacZones ? 0.12 : 0);
        map.setPaintProperty(evacLineId, "line-width", showEvacZones ? 1.5 : 0);
      }

      // 7. NWS Warning Polygons Layer (Subtle translucent fills, crisp borders)
      const warnSourceId = "nws-warnings-source";
      const warnFillId = "nws-warnings-fill";
      const warnLineId = "nws-warnings-line";

      const warningFeatures = alerts
        .filter((a) => a.geometry && a.geometry.coordinates)
        .map((a) => {
          let color = "#F59E0B";
          if (a.phenomena === "HU" || a.event.includes("Hurricane")) color = "#EF4444";
          else if (a.phenomena === "SS" || a.event.includes("Surge")) color = "#A855F7";
          else if (a.phenomena === "FF" || a.event.includes("Flood")) color = "#10B981";
          else if (a.phenomena === "EW" || a.phenomena === "TO") color = "#F43F5E";

          return {
            type: "Feature",
            geometry: a.geometry,
            properties: {
              id: a.id,
              eventKey: a.eventKey,
              headline: a.headline,
              event: a.event,
              severity: a.severity,
              color,
              isTranche1Eligible: a.isTranche1Eligible,
              effective: a.effective,
              expires: a.expires,
              office: a.office,
            },
          };
        });

      const warnCollection = { type: "FeatureCollection", features: warningFeatures };

      if (!map.getSource(warnSourceId)) {
        map.addSource(warnSourceId, { type: "geojson", data: warnCollection });

        map.addLayer({
          id: warnFillId,
          type: "fill",
          source: warnSourceId,
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": showWarnings ? 0.14 : 0, // Clean translucent fill, not opaque carpet
          },
        });

        map.addLayer({
          id: warnLineId,
          type: "line",
          source: warnSourceId,
          paint: {
            "line-color": ["get", "color"],
            "line-width": showWarnings ? 1.8 : 0,
          },
        });

        map.on("click", warnFillId, (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props) {
            const match = alerts.find((a) => a.id === props.id);
            setSelectedItem({
              type: "ALERT",
              title: props.event || props.headline,
              headline: props.headline,
              details: `Issuing Office: ${props.office || "TBW"} · VTEC: ${props.eventKey || "NWS"}`,
              severity: props.severity,
              badge: props.isTranche1Eligible ? "TRANCHE 1 TRIGGER" : "ADVISORY",
              isTranche1: props.isTranche1Eligible,
              effective: props.effective,
              expires: props.expires,
            });
            if (match && onSelectAlert) onSelectAlert(match);
          }
        });
      } else {
        map.getSource(warnSourceId).setData(warnCollection);
        map.setPaintProperty(warnFillId, "fill-opacity", showWarnings ? 0.14 : 0);
        map.setPaintProperty(warnLineId, "line-width", showWarnings ? 1.8 : 0);
      }

      // 8. Privacy-Preserving Household Exposure Clusters (Small elegant circular badges)
      const clusterSourceId = "household-clusters-source";
      const clusterCircleId = "household-clusters-circle";
      const clusterLabelId = "household-clusters-label";

      const clusterFeatures = (clusters?.clusters || []).map((c) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [c.centroid.lng, c.centroid.lat],
        },
        properties: {
          clusterId: c.clusterId,
          clusterName: c.clusterName,
          zone: c.zone,
          totalHouseholds: c.totalHouseholds,
          confirmedExposedCount: c.confirmedExposedCount,
          medicalDeviceCount: c.medicalDeviceCount,
          isExposed: c.confirmedExposedCount > 0,
          color:
            c.confirmedExposedCount > 0
              ? c.medicalDeviceCount > 0
                ? "#EF4444"
                : "#F97316"
              : "#10B981",
        },
      }));

      const clusterCollection = { type: "FeatureCollection", features: clusterFeatures };

      if (!map.getSource(clusterSourceId)) {
        map.addSource(clusterSourceId, { type: "geojson", data: clusterCollection });

        map.addLayer({
          id: clusterCircleId,
          type: "circle",
          source: clusterSourceId,
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "totalHouseholds"],
              1,
              9,
              10,
              16,
            ],
            "circle-opacity": showClusters ? 0.90 : 0,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        map.addLayer({
          id: clusterLabelId,
          type: "symbol",
          source: clusterSourceId,
          layout: {
            "text-field": ["to-string", ["get", "totalHouseholds"]],
            "text-size": 10,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#FFFFFF",
            "text-opacity": showClusters ? 1 : 0,
          },
        });

        map.on("click", clusterCircleId, (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props) {
            const match = clusters?.clusters.find((c) => c.clusterId === props.clusterId);
            setSelectedItem({
              type: "CLUSTER",
              title: props.clusterName,
              headline: `${props.zone}`,
              details: `${props.totalHouseholds} households (${props.confirmedExposedCount} in hazard zone, ${props.medicalDeviceCount} medical dependent)`,
              badge: props.confirmedExposedCount > 0 ? "EXPOSURE CONFIRMED" : "SAFE / UNEXPOSED",
            });
            if (match && onSelectCluster) onSelectCluster(match);
          }
        });
      } else {
        map.getSource(clusterSourceId).setData(clusterCollection);
        map.setPaintProperty(clusterCircleId, "circle-opacity", showClusters ? 0.90 : 0);
        map.setPaintProperty(clusterLabelId, "text-opacity", showClusters ? 1 : 0);
      }
    } catch (err) {
      console.warn("[STORM_ATLAS] Error synchronizing map layers:", err);
    }
  }, [
    mapLoaded,
    engineMode,
    fund,
    alerts,
    clusters,
    showSatellite,
    showSatelliteClouds,
    showCloudTops,
    cloudTopsOpacity,
    showRadar,
    radarOpacity,
    showWarnings,
    showNHCTrack,
    showEvacZones,
    showClusters,
    radarOutage,
    forceRadarOutage,
    cloudRasters,
    onSelectAlert,
    onSelectCluster,
  ]);

  // --- 2D SVG GEOSPATIAL ENGINE FALLBACK ---
  const svgWidth = 1000;
  const svgHeight = 540;
  const mapBounds = fund.bounds;

  const coastlinesSvg = useMemo(() => {
    const pinellasCoast = [
      [-82.85, 28.18],
      [-82.83, 28.05],
      [-82.82, 27.95],
      [-82.85, 27.85],
      [-82.75, 27.65],
      [-82.68, 27.6],
      [-82.58, 27.65],
      [-82.6, 27.78],
      [-82.62, 27.9],
      [-82.68, 28.02],
      [-82.72, 28.18],
    ];

    const hillsboroughCoast = [
      [-82.55, 28.05],
      [-82.48, 27.92],
      [-82.42, 27.88],
      [-82.38, 27.75],
      [-82.45, 27.65],
      [-82.52, 27.55],
      [-82.62, 27.5],
      [-82.72, 27.52],
    ];

    const path1 =
      pinellasCoast
        .map((pt, i) => {
          const [x, y] = projectMercator(pt[0], pt[1], svgWidth, svgHeight, mapBounds);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z";

    const path2 =
      hillsboroughCoast
        .map((pt, i) => {
          const [x, y] = projectMercator(pt[0], pt[1], svgWidth, svgHeight, mapBounds);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z";

    return { path1, path2 };
  }, [mapBounds]);

  return (
    <div className="relative w-full h-[640px] md:h-[720px] lg:h-[780px] bg-surface overflow-hidden rounded-2xl border border-line shadow-2xl select-none">
      {/* WEBGL MAPLIBRE 3D CONTAINER */}
      <div
        ref={mapContainerRef}
        className={`w-full h-full transition-opacity duration-500 ${
          engineMode === "WEBGL" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* 2D SVG FALLBACK ENGINE */}
      {engineMode === "SVG_2D" && (
        <div className="absolute inset-0 z-0 bg-canvas">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{
              transform: `translate(${svgPan.x}px, ${svgPan.y}px) scale(${svgZoom})`,
              transformOrigin: "center center",
            }}
          >
            <rect width={svgWidth} height={svgHeight} fill="#090d16" />

            <path
              d={coastlinesSvg.path1}
              fill="#111827"
              stroke="#334155"
              strokeWidth="1.5"
              opacity="0.85"
            />
            <path
              d={coastlinesSvg.path2}
              fill="none"
              stroke="#334155"
              strokeWidth="1.5"
              opacity="0.85"
            />

            {/* Evacuation Zones */}
            {showEvacZones &&
              TAMPA_BAY_SURGE_ZONES_COLLECTION.features.map((feature: EvacuationZoneFeature) => {
                const pathStr = polygonToSvgPath(
                  feature.geometry.coordinates,
                  svgWidth,
                  svgHeight,
                  mapBounds
                );
                if (!pathStr) return null;
                return (
                  <path
                    key={feature.properties.zoneId}
                    d={pathStr}
                    fill={feature.properties.color}
                    fillOpacity="0.14"
                    stroke={feature.properties.strokeColor}
                    strokeWidth="1.2"
                    className="hover:fill-opacity-30 transition-all cursor-pointer"
                    onClick={() =>
                      setSelectedItem({
                        type: "ZONE",
                        title: feature.properties.zoneName,
                        headline: `Surge Risk: ${feature.properties.surgeRisk} · Tier: ${feature.properties.evacTier}`,
                        details: feature.properties.description,
                        badge: feature.properties.evacTier === "MANDATORY" ? "MANDATORY EVACUATION" : "ADVISORY ZONE",
                      })
                    }
                  />
                );
              })}

            {/* Warning Polygons */}
            {showWarnings &&
              alerts.map((alert) => {
                if (!alert.geometry || !alert.geometry.coordinates) return null;
                const pathStr = polygonToSvgPath(
                  alert.geometry.coordinates,
                  svgWidth,
                  svgHeight,
                  mapBounds
                );
                if (!pathStr) return null;

                let color = "#F59E0B";
                if (alert.phenomena === "HU" || alert.event.includes("Hurricane")) color = "#EF4444";
                else if (alert.phenomena === "SS" || alert.event.includes("Surge")) color = "#A855F7";
                else if (alert.phenomena === "FF" || alert.event.includes("Flood")) color = "#10B981";

                return (
                  <path
                    key={alert.id}
                    d={pathStr}
                    fill={color}
                    fillOpacity="0.16"
                    stroke={color}
                    strokeWidth="1.8"
                    className="hover:fill-opacity-35 transition-all cursor-pointer"
                    onClick={() =>
                      setSelectedItem({
                        type: "ALERT",
                        title: alert.event || alert.headline,
                        headline: alert.headline,
                        details: `Issuing Office: ${alert.office} · VTEC: ${alert.eventKey}`,
                        severity: alert.severity,
                        badge: alert.isTranche1Eligible ? "TRANCHE 1 TRIGGER" : "ADVISORY",
                        isTranche1: alert.isTranche1Eligible,
                        effective: alert.effective,
                        expires: alert.expires,
                      })
                    }
                  />
                );
              })}

            {/* Household Clusters */}
            {showClusters &&
              clusters?.clusters.map((c) => {
                const [cx, cy] = projectMercator(
                  c.centroid.lng,
                  c.centroid.lat,
                  svgWidth,
                  svgHeight,
                  mapBounds
                );
                const isExposed = c.confirmedExposedCount > 0;
                const color = isExposed ? "#F97316" : "#10B981";

                return (
                  <g
                    key={c.clusterId}
                    className="cursor-pointer group"
                    onClick={() =>
                      setSelectedItem({
                        type: "CLUSTER",
                        title: c.clusterName,
                        headline: c.zone,
                        details: `${c.totalHouseholds} households (${c.confirmedExposedCount} in hazard zone)`,
                        badge: isExposed ? "EXPOSURE CONFIRMED" : "SAFE / UNEXPOSED",
                      })
                    }
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r="12"
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                      fillOpacity="0.9"
                    />
                    <text
                      x={cx}
                      y={cy + 3.5}
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {c.totalHouseholds}
                    </text>
                  </g>
                );
              })}
          </svg>

          <div className="absolute bottom-16 left-4 z-10 max-w-sm bg-surface-2/90 border border-line/80 rounded-xl p-2.5 backdrop-blur-md text-xs text-ink-2 flex items-center gap-2 shadow-xl">
            <span className="text-amber font-bold text-sm">ℹ️</span>
            <div>
              <span className="font-semibold text-white">2D Geospatial Fallback Active</span>
              <p className="text-[11px] text-ink-2">
                Vector warning polygons, evacuation zones, and household exposure calculations active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TOP-LEFT STATUS DESK HEADER */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg border ${
              mode === "LIVE"
                ? "bg-delivered-soft/80 text-delivered border-delivered/80"
                : "bg-amber-soft/80 text-amber border-amber/80"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                mode === "LIVE" ? "bg-delivered animate-pulse" : "bg-amber"
              }`}
            />
            <span>{mode === "HISTORICAL_REPLAY" ? "HISTORICAL REPLAY" : "LIVE FEED"}</span>
          </div>

          {/* Scope Badge */}
          <div className="px-2.5 py-1 rounded-xl text-xs font-semibold text-ink bg-surface-2/90 border border-line/80 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
            <I.pin className="w-3.5 h-3.5 text-paypal" />
            <span>Tampa Bay, FL</span>
            <span className="text-[10px] text-ink-2 font-mono">(WFO TBW)</span>
          </div>

          {/* Sensor Identification */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-ai bg-ai-soft/70 border border-ai-line/80 backdrop-blur-md shadow-lg">
            <I.pulse className="w-3 h-3 text-ai" />
            <span>GOES-16 ABI · nowCOAST WMS</span>
          </div>
        </div>

        {/* Observation Timestamp & Sensor Attribution */}
        <div className="text-[10px] text-ink-2/90 font-mono bg-surface/75 border border-line/80 px-2 py-0.5 rounded-lg backdrop-blur-md self-start pointer-events-auto flex items-center gap-2">
          <I.clock className="w-3 h-3 text-ink-2" />
          <span>Valid: {currentFrame.displayTime}</span>
          <span className="text-ink0">|</span>
          <span className="text-ink-2">Esri / NASA GIBS / NOAA</span>
        </div>
      </div>

      {/* TOP-RIGHT CONTROLS: Camera Mode & Layer Switcher */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* CAMERA MODE SWITCHER (Weather View [Default] vs 3D Explore vs Globe) */}
          <div className="flex items-center bg-surface-2/90 border border-line/80 rounded-xl p-0.5 backdrop-blur-md shadow-xl">
            <button
              onClick={transitionToWeatherView}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                cameraMode === "WEATHER_VIEW"
                  ? "bg-paypal text-white shadow"
                  : "text-ink-2 hover:text-ink"
              }`}
              title="Overhead Meteorological Weather View (Default)"
            >
              <I.compass className="w-3.5 h-3.5" />
              <span>Weather View</span>
            </button>

            <button
              onClick={transitionTo3DExplore}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                cameraMode === "EXPLORE_3D"
                  ? "bg-paypal text-white shadow"
                  : "text-ink-2 hover:text-ink"
              }`}
              title="Optional 3D Perspective Explore Mode with Terrain Tilt"
            >
              <I.maximize className="w-3.5 h-3.5" />
              <span>3D Explore</span>
            </button>

            <button
              onClick={transitionToGlobe}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                cameraMode === "GLOBE"
                  ? "bg-paypal text-white shadow"
                  : "text-ink-2 hover:text-ink"
              }`}
              title="Orbital Weather Globe View"
            >
              <I.world className="w-3.5 h-3.5" />
              <span>Globe</span>
            </button>
          </div>

          {/* Guided Tour Presentation Button */}
          <button
            onClick={handleStartCinematicTour}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-lg backdrop-blur-md ${
              isCinematicTourActive
                ? "bg-amber text-white border-amber animate-pulse"
                : "bg-gradient-to-r from-paypal to-ai hover:from-paypal hover:to-ai text-white border-paypal0/80"
            }`}
            title="Launch 10-step Demonstration Sequence (Finishes Overhead)"
          >
            <I.aiAdvisor className="w-3.5 h-3.5" />
            <span>{isCinematicTourActive ? `Tour ${cinematicStep}/10` : "Tour"}</span>
          </button>

          {/* Settings / Opacity Popover Button */}
          <button
            onClick={() => setShowSettingsPopover(!showSettingsPopover)}
            className="p-1.5 bg-surface-2/90 hover:bg-surface-3 border border-line/80 rounded-xl text-ink-2 hover:text-white transition-colors shadow-lg backdrop-blur-md"
            title="Weather Layer Controls & Display Settings"
          >
            <I.sliders className="w-4 h-4" />
          </button>
        </div>

        {/* COMPACT FLOATING LAYER SWITCHER */}
        <div className="flex flex-wrap items-center gap-1 bg-surface-2/90 border border-line/80 rounded-xl p-1 backdrop-blur-md shadow-xl pointer-events-auto text-xs">
          <button
            onClick={() => setShowSatellite(!showSatellite)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showSatellite
                ? "bg-surface-3/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Satellite
          </button>

          <button
            onClick={() => setShowSatelliteClouds(!showSatelliteClouds)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showSatelliteClouds
                ? "bg-paypal/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Clouds
          </button>

          <button
            onClick={() => setShowCloudTops(!showCloudTops)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showCloudTops
                ? "bg-ai/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Cloud Tops
          </button>

          <button
            onClick={() => setShowRadar(!showRadar)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showRadar
                ? "bg-accent/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Radar
          </button>

          <button
            onClick={() => setShowWarnings(!showWarnings)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showWarnings
                ? "bg-amber/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Warnings
          </button>

          <button
            onClick={() => setShowNHCTrack(!showNHCTrack)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showNHCTrack
                ? "bg-danger/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Track
          </button>

          <button
            onClick={() => setShowEvacZones(!showEvacZones)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showEvacZones
                ? "bg-ai/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Surge
          </button>

          <button
            onClick={() => setShowClusters(!showClusters)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
              showClusters
                ? "bg-accent/90 text-white"
                : "text-ink0 hover:text-ink-2"
            }`}
          >
            Households
          </button>

          <button
            onClick={() => {
              if (cameraMode === "WEATHER_VIEW") transitionToWeatherView();
              else if (cameraMode === "EXPLORE_3D") transitionTo3DExplore();
              else transitionToGlobe();
            }}
            className="px-2 py-0.5 rounded-lg text-[11px] text-ink-2 hover:text-white bg-surface-3/80 transition-colors ml-1"
            title="Reset camera orientation"
          >
            Reset
          </button>
        </div>

        {/* SETTINGS POPOVER (Opacity, Basemap, 3D Pitch) */}
        {showSettingsPopover && (
          <div className="bg-surface-2/95 border border-line/80 rounded-2xl p-3.5 backdrop-blur-xl shadow-2xl space-y-3 w-64 pointer-events-auto text-xs text-ink animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-line pb-1.5">
              <span className="font-bold text-white">Display & Sensor Settings</span>
              <button
                onClick={() => setShowSettingsPopover(false)}
                className="text-ink-2 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Radar Opacity */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-ink-2">Radar Opacity</span>
                <span className="font-mono text-delivered">{Math.round(radarOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={radarOpacity}
                onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
                className="w-full accent-delivered0 cursor-pointer"
              />
            </div>

            {/* Cloud Tops Opacity */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-ink-2">Cloud Tops Opacity</span>
                <span className="font-mono text-ai">{Math.round(cloudTopsOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={cloudTopsOpacity}
                onChange={(e) => setCloudTopsOpacity(parseFloat(e.target.value))}
                className="w-full accent-ai0 cursor-pointer"
              />
            </div>

            {/* 3D Explore Tilt Slider (Active only in 3D Explore mode) */}
            {cameraMode === "EXPLORE_3D" && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-2">Perspective Pitch</span>
                  <span className="font-mono text-paypal">{explorePitch}°</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="75"
                  step="5"
                  value={explorePitch}
                  onChange={(e) => {
                    const p = parseInt(e.target.value, 10);
                    setExplorePitch(p);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setPitch(p);
                    }
                  }}
                  className="w-full accent-paypal0 cursor-pointer"
                />
              </div>
            )}

            {/* Basemap Switcher */}
            <div className="space-y-1 pt-1 border-t border-line">
              <span className="text-ink-2 text-[11px]">Basemap Surface</span>
              <div className="grid grid-cols-2 gap-1 pt-0.5">
                {(Object.keys(BASEMAP_STYLES) as BasemapTheme[]).map((themeKey) => (
                  <button
                    key={themeKey}
                    onClick={() => handleBasemapChange(themeKey)}
                    className={`py-1 px-1.5 rounded text-[10px] font-semibold text-center transition-all ${
                      selectedBasemap === themeKey
                        ? "bg-paypal text-white"
                        : "bg-surface-3 text-ink-2 hover:text-white"
                    }`}
                  >
                    {themeKey === "satellite"
                      ? "Satellite"
                      : themeKey === "nasa_gibs"
                      ? "NASA GIBS"
                      : themeKey === "dark"
                      ? "Dark"
                      : "Vector"}
                  </button>
                ))}
              </div>
            </div>

            {/* Radar Outage Simulator */}
            <div className="pt-1 border-t border-line flex items-center justify-between">
              <span className="text-ink-2 text-[11px]">nowCOAST WMS</span>
              <button
                data-testid="radar-outage-toggle"
                onClick={() => setRadarOutage(!radarOutage)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  radarOutage
                    ? "bg-danger-soft text-danger border border-danger"
                    : "bg-surface-3 text-ink-2 hover:text-white"
                }`}
              >
                {radarOutage ? "Simulated Outage" : "Online"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BROADCAST STORM INFORMATION CARD (Floating Bottom-Left) */}
      {showStormCard && (
        <div className="absolute bottom-20 left-3 z-10 max-w-xs bg-surface/90 border border-line rounded-2xl p-3 backdrop-blur-xl shadow-2xl text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-line/80 pb-1.5">
            <div className="flex items-center gap-1.5">
              <I.wind className="w-4 h-4 text-danger" />
              <span className="font-bold text-white tracking-wide">HURRICANE MILTON</span>
            </div>
            <span className="px-2 py-0.5 bg-danger-soft/80 text-danger border border-danger-line rounded text-[10px] font-extrabold uppercase tracking-wider">
              CAT {currentFrame.category}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-surface-2/80 rounded-lg p-1.5 border border-line/80">
              <span className="text-ink-2 text-[10px] block">Max Winds</span>
              <span className="font-bold text-white text-xs">{currentFrame.windSpeedMph} mph</span>
            </div>
            <div className="bg-surface-2/80 rounded-lg p-1.5 border border-line/80">
              <span className="text-ink-2 text-[10px] block">Central Pressure</span>
              <span className="font-mono text-white text-xs">{currentFrame.pressureMb} mb</span>
            </div>
          </div>

          <p className="text-[11px] text-ink-2 leading-tight">
            {currentFrame.headline}
          </p>

          <div className="text-[10px] text-ink-2 font-mono flex items-center justify-between pt-1 border-t border-line/80">
            <span>NHC Advisory 19 / 20</span>
            <span className="text-delivered">67% Cone Active</span>
          </div>
        </div>
      )}

      {/* CLOUD-TOP ALTITUDE SCIENTIFIC LEGEND (When Cloud Tops Layer is Active) */}
      {showCloudTops && (
        <div className="absolute bottom-20 right-3 z-10 bg-surface/90 border border-line rounded-xl px-2.5 py-1.5 backdrop-blur-xl shadow-2xl text-[10px] text-ink-2 space-y-1 max-w-[200px]">
          <span className="font-bold text-white block">GOES-16 Cloud Tops (ACHA)</span>
          <div className="h-2 w-full rounded-sm bg-gradient-to-r from-paypal via-ai via-ai to-danger" />
          <div className="flex justify-between text-[9px] text-ink-2 font-mono">
            <span>5,000m</span>
            <span>10,000m</span>
            <span>16,000m+</span>
          </div>
        </div>
      )}

      {/* BOTTOM WEATHER TIMELINE BAR */}
      <div className="absolute bottom-3 left-3 right-3 z-10 bg-surface/95 border border-line rounded-2xl p-2.5 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Playback Controls & Frame Headline */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
            className="w-8 h-8 rounded-xl bg-paypal hover:bg-paypal0 text-white flex items-center justify-center transition-colors shadow-lg"
            title={isPlayingTimeline ? "Pause timeline replay" : "Play timeline progression"}
          >
            {isPlayingTimeline ? <I.pause className="w-4 h-4" /> : <I.play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-2">
              Meteorological Timeline
            </span>
            <span className="font-mono font-bold text-white text-xs">
              {currentFrame.displayTime}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-line text-ink-2 text-[11px]">
            <span className="text-amber font-semibold">{currentFrame.windSpeedMph} mph</span>
            <span>·</span>
            <span className="font-mono text-ink-2">{currentFrame.pressureMb} mb</span>
            <span>·</span>
            <span className="truncate max-w-xs text-ink-2">{currentFrame.headline}</span>
          </div>
        </div>

        {/* Timeline Frame Scrubber */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md w-full">
          {TIMELINE_FRAMES.map((frame, idx) => (
            <button
              key={frame.id}
              onClick={() => {
                setTimelineIndex(idx);
                setIsPlayingTimeline(false);
              }}
              className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-medium transition-all text-center border ${
                timelineIndex === idx
                  ? "bg-paypal/90 text-white border-paypal shadow-md font-bold"
                  : "bg-surface-2/80 text-ink-2 border-line hover:text-ink"
              }`}
            >
              {frame.displayTime.split("·")[1]?.trim() || frame.displayTime}
            </button>
          ))}
        </div>
      </div>

      {/* CONTEXTUAL INSPECTION DRAWER */}
      {selectedItem && (
        <div className="absolute top-20 right-3 z-20 max-w-sm w-full bg-surface-2/95 border border-line/80 rounded-2xl p-4 backdrop-blur-xl shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-right-2">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
            <span className="text-xs font-bold text-white truncate">{selectedItem.title}</span>
            {selectedItem.badge && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                  selectedItem.isTranche1
                    ? "bg-danger-soft text-danger border border-danger-line"
                    : selectedItem.type === "CLOUD_TOP"
                    ? "bg-ai-soft text-ai border border-ai-line"
                    : selectedItem.type === "TRACK_POINT"
                    ? "bg-amber-soft text-amber border border-amber-line"
                    : "bg-delivered-soft text-delivered border border-delivered-line"
                }`}
              >
                {selectedItem.badge}
              </span>
            )}
            <button
              onClick={() => setSelectedItem(null)}
              className="text-ink-2 hover:text-ink text-xs ml-auto"
            >
              ✕
            </button>
          </div>

          {selectedItem.headline && (
            <div className="text-xs font-semibold text-ink">{selectedItem.headline}</div>
          )}

          <p className="text-xs text-ink-2 leading-relaxed">{selectedItem.details}</p>

          {selectedItem.type === "CLOUD_TOP" && selectedItem.altitudeMeters && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line text-[11px] text-ink-2 font-mono">
              <div className="bg-surface/60 p-1.5 rounded-lg border border-line">
                <span className="text-ink0 text-[10px] block">Altitude</span>
                <span className="text-white font-bold">{selectedItem.altitudeMeters.toLocaleString()} m</span>
              </div>
              <div className="bg-surface/60 p-1.5 rounded-lg border border-line">
                <span className="text-ink0 text-[10px] block">IR Brightness</span>
                <span className="text-ai font-bold">{selectedItem.tempC}°C</span>
              </div>
            </div>
          )}

          {selectedItem.effective && (
            <div className="text-[10px] text-ink-2 pt-1 font-mono">
              Valid: {new Date(selectedItem.effective).toUTCString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
