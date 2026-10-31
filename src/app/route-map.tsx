"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { TaxiStop } from "@/data/taxi-stops";
import { taxiMarkerIcon } from "./taxi-marker";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number };

type RouteLine = {
  coordinates: [number, number][];
  distance: number;
  duration: number;
};

export type LocationState = "idle" | "locating" | "ready" | "denied" | "unsupported";

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function FitTo({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const signature = positions.map((position) => position.join(",")).join(";");

  useEffect(() => {
    const next = signature
      .split(";")
      .filter(Boolean)
      .map((pair) => {
        const [lat, lng] = pair.split(",").map(Number);
        return [lat, lng] as [number, number];
      });
    if (next.length === 0) return;
    if (next.length === 1) {
      map.setView(next[0], 15);
      return;
    }
    map.fitBounds(next, { padding: [28, 28] });
  }, [map, signature]);

  return null;
}

function RouteCanvas({
  stop,
  origin,
  line,
}: {
  stop: TaxiStop;
  origin: MapPoint | null;
  line: RouteLine | null;
}) {
  const positions: [number, number][] = line?.coordinates ?? [
    ...(origin ? [[origin.lat, origin.lng] as [number, number]] : []),
    [stop.lat, stop.lng],
  ];

  return (
    <MapContainer
      center={[stop.lat, stop.lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTo positions={positions} />
      {line ? (
        <Polyline positions={line.coordinates} pathOptions={{ color: "#c2410c", weight: 5 }} />
      ) : null}
      {origin ? (
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={8}
          pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 1 }}
        >
          <Popup>Ta position</Popup>
        </CircleMarker>
      ) : null}
      <Marker position={[stop.lat, stop.lng]} icon={taxiMarkerIcon(false)}>
        <Popup>
          {stop.name}
          <br />
          {stop.address}
        </Popup>
      </Marker>
    </MapContainer>
  );
}

export function StopPanel({
  stop,
  origin,
  locationState,
}: {
  stop: TaxiStop;
  origin: MapPoint | null;
  locationState: LocationState;
}) {
  const [line, setLine] = useState<RouteLine | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [line, routing, locationState]);

  useEffect(() => {
    if (!origin) return;
    const controller = new AbortController();
    setRouting(true);
    setRouteError(null);
    setLine(null);

    const params = new URLSearchParams({
      from: `${origin.lat},${origin.lng}`,
      to: `${stop.lat},${stop.lng}`,
    });

    fetch(`/api/itinerary?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          coordinates?: [number, number][];
          distance?: number;
          duration?: number;
          error?: string;
        };
        if (!response.ok || !data.coordinates || data.distance == null || data.duration == null) {
          throw new Error(data.error ?? "Itinéraire indisponible.");
        }
        setLine({
          coordinates: data.coordinates,
          distance: data.distance,
          duration: data.duration,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRouteError(error instanceof Error ? error.message : "Itinéraire indisponible.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });

    return () => controller.abort();
  }, [origin, stop]);

  let status = "Arrêt placé sur la carte.";
  if (locationState === "locating") status = "Lecture de ta position…";
  if (locationState === "denied" || locationState === "unsupported") {
    status = "Active la localisation pour calculer l’itinéraire depuis là où tu es.";
  }
  if (routing) status = "Calcul de l’itinéraire…";
  if (line) status = `${formatDuration(line.duration)} · ${formatDistance(line.distance)} jusqu’à l’arrêt`;
  if (routeError) status = routeError;

  return (
    <section
      ref={panelRef}
      className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
    >
      <div className="px-4 py-3">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">Arrêt de taxi</p>
        <h2 className="text-lg font-semibold tracking-tight">{stop.name}</h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{stop.address}</p>
        <p className="mt-1 text-sm text-zinc-500">{status}</p>
      </div>
      <div className="h-72 border-t border-zinc-200 dark:border-zinc-800">
        <RouteCanvas stop={stop} origin={origin} line={line} />
      </div>
    </section>
  );
}
