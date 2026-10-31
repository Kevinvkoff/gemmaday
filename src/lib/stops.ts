import "server-only";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TaxiStop } from "@/data/taxi-stops";

const stopsFile = path.join(process.cwd(), "data", "stops.json");

const lubumbashi = {
  minLat: -12.2,
  maxLat: -11.2,
  minLng: 27.2,
  maxLng: 27.9,
};

export function readStops(): TaxiStop[] {
  const parsed = JSON.parse(readFileSync(stopsFile, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !parsed.every(isTaxiStop)) {
    throw new Error("Le fichier des arrêts est illisible.");
  }
  return parsed;
}

export function writeStops(stops: TaxiStop[]) {
  if (stops.length > 80) {
    throw new Error("Trop d’arrêts.");
  }
  const ids = new Set<string>();
  for (const stop of stops) {
    if (!isTaxiStop(stop)) throw new Error("Un arrêt est incomplet.");
    if (!inLubumbashi(stop.lat, stop.lng)) {
      throw new Error("Le point doit être à Lubumbashi.");
    }
    if (ids.has(stop.id)) throw new Error("Deux arrêts portent le même identifiant.");
    ids.add(stop.id);
  }
  writeFileSync(stopsFile, `${JSON.stringify(stops, null, 2)}\n`);
}

export function findTaxiStop(id: string | null | undefined) {
  if (!id) return null;
  return readStops().find((stop) => stop.id === id) ?? null;
}

export function taxiStopCatalog() {
  return readStops()
    .map((stop) => `${stop.id} | ${stop.name} | ${stop.address} | ${stop.serves}`)
    .join("\n");
}

function inLubumbashi(lat: number, lng: number) {
  return lat >= lubumbashi.minLat && lat <= lubumbashi.maxLat && lng >= lubumbashi.minLng && lng <= lubumbashi.maxLng;
}

function isTaxiStop(value: unknown): value is TaxiStop {
  if (!value || typeof value !== "object") return false;
  const stop = value as TaxiStop;
  return (
    typeof stop.id === "string" &&
    /^[a-z0-9-]{1,48}$/.test(stop.id) &&
    typeof stop.name === "string" &&
    stop.name.trim().length > 0 &&
    stop.name.trim().length <= 80 &&
    typeof stop.address === "string" &&
    stop.address.trim().length > 0 &&
    stop.address.trim().length <= 160 &&
    typeof stop.serves === "string" &&
    stop.serves.trim().length > 0 &&
    stop.serves.trim().length <= 300 &&
    Number.isFinite(stop.lat) &&
    Number.isFinite(stop.lng)
  );
}
