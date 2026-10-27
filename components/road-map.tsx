"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import { Layers } from "lucide-react";
import type { LatLng } from "@/lib/types";
import { cx } from "./ui";

export interface MapPin {
  id: string;
  position: LatLng;
  label: string;
  title: string;
  tone: "home" | "me" | "selected" | "damage" | "fixed";
}

type Mode = "view" | "draw" | "place";

const DEFAULT_CENTER: LatLng = { lat: 44.5, lng: -89.5 };

/**
 * Leaflet map for drawing the road (tap from the entrance to the far end),
 * placing driveways, and showing damage pins. Leaflet loads only in the browser.
 */
export function RoadMap({
  center,
  path,
  pins = [],
  mode = "view",
  onAddPoint,
  onPlace,
  onPinClick,
  height = 360,
  className,
}: {
  center: LatLng | null;
  path: LatLng[];
  pins?: MapPin[];
  mode?: Mode;
  onAddPoint?: (p: LatLng) => void;
  onPlace?: (p: LatLng) => void;
  onPinClick?: (id: string) => void;
  height?: number;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof L | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ road?: L.Polyline; vertices?: L.LayerGroup; pins?: L.LayerGroup; street?: L.TileLayer; satellite?: L.TileLayer }>({});
  const handlers = useRef({ mode, onAddPoint, onPlace, onPinClick });
  useEffect(() => {
    handlers.current = { mode, onAddPoint, onPlace, onPinClick };
  });
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const fitted = useRef(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lmod = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      leaflet.current = Lmod;
      const start = center ?? path[0] ?? DEFAULT_CENTER;
      const m = Lmod.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], center || path.length ? 16 : 6);
      layers.current.street = Lmod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      layers.current.satellite = Lmod.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Imagery &copy; Esri",
      });
      layers.current.vertices = Lmod.layerGroup().addTo(m);
      layers.current.pins = Lmod.layerGroup().addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (handlers.current.mode === "draw") handlers.current.onAddPoint?.(p);
        if (handlers.current.mode === "place") handlers.current.onPlace?.(p);
      });
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Street / satellite
  useEffect(() => {
    const m = map.current;
    const { street, satellite: sat } = layers.current;
    if (!ready || !m || !street || !sat) return;
    if (satellite) {
      m.removeLayer(street);
      sat.addTo(m);
    } else {
      m.removeLayer(sat);
      street.addTo(m);
    }
  }, [satellite, ready]);

  // Recenter when a search result moves the center.
  useEffect(() => {
    if (ready && center && map.current && path.length === 0) map.current.setView([center.lat, center.lng], 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, ready]);

  // Road line and its points
  useEffect(() => {
    const Lm = leaflet.current;
    const m = map.current;
    if (!ready || !Lm || !m) return;
    layers.current.road?.remove();
    layers.current.vertices?.clearLayers();
    if (path.length > 0) {
      layers.current.road = Lm.polyline(
        path.map((p) => [p.lat, p.lng]),
        { color: "#1E2320", weight: 9, opacity: 0.85, lineCap: "round", lineJoin: "round", interactive: false },
      ).addTo(m);
      Lm.polyline(
        path.map((p) => [p.lat, p.lng]),
        { color: "#F2A900", weight: 2, opacity: 0.9, dashArray: "6 8", interactive: false },
      ).addTo(layers.current.vertices!);
      path.forEach((p, i) => {
        if (mode !== "draw" && i !== 0) return;
        Lm.circleMarker([p.lat, p.lng], {
          radius: i === 0 ? 8 : 5,
          color: "#fff",
          weight: 2,
          fillColor: i === 0 ? "#1F5E3B" : "#1E2320",
          fillOpacity: 1,
          interactive: false,
        })
          .bindTooltip(i === 0 ? "Entrance" : "", { permanent: i === 0, direction: "top", offset: [0, -8] })
          .addTo(layers.current.vertices!);
      });
    }
    if (!fitted.current && (path.length > 1 || pins.length > 1)) {
      const pts = [...path, ...pins.map((x) => x.position)];
      m.fitBounds(Lm.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 17 });
      fitted.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, mode, ready]);

  // Pins
  useEffect(() => {
    const Lm = leaflet.current;
    const group = layers.current.pins;
    if (!ready || !Lm || !group) return;
    group.clearLayers();
    for (const pin of pins) {
      const style =
        pin.tone === "damage"
          ? "background:#B3261E;color:#fff"
          : pin.tone === "fixed"
            ? "background:#5C6159;color:#fff"
            : pin.tone === "selected"
              ? "background:#F2A900;color:#1E2320"
              : pin.tone === "me"
                ? "background:#1F5E3B;color:#fff"
                : "background:#fff;color:#1E2320";
      const icon = Lm.divIcon({
        className: "rf-pin",
        html: `<div style="${style};min-width:28px;height:28px;padding:0 6px;border-radius:14px;border:2px solid #1E2320;display:flex;align-items:center;justify-content:center;font:700 13px/1 system-ui;box-shadow:0 2px 6px rgba(0,0,0,.25)">${escapeHtml(pin.label)}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = Lm.marker([pin.position.lat, pin.position.lng], { icon, title: pin.title, keyboard: true, riseOnHover: true });
      marker.on("click", () => handlers.current.onPinClick?.(pin.id));
      marker.bindTooltip(escapeHtml(pin.title), { direction: "top", offset: [0, -14] });
      marker.addTo(group);
    }
  }, [pins, ready]);

  useEffect(() => {
    if (map.current) map.current.getContainer().style.cursor = mode === "view" ? "" : "crosshair";
  }, [mode, ready]);

  return (
    <div className={cx("relative overflow-hidden rounded-xl border border-line", className)} style={{ height }}>
      <div ref={el} className="h-full w-full" role="application" aria-label="Road map" />
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        className="absolute right-2.5 top-2.5 z-[500] inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[0.88rem] font-semibold shadow-card"
      >
        <Layers className="h-4 w-4" aria-hidden />
        {satellite ? "Map" : "Satellite"}
      </button>
      {!ready && <div className="absolute inset-0 flex items-center justify-center bg-paper-2 text-stone">Loading map…</div>}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
