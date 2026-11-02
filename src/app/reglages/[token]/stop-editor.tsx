"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { TaxiStop } from "@/data/taxi-stops";
import { taxiMarkerIcon } from "@/app/taxi-marker";
import "leaflet/dist/leaflet.css";

type Draft = {
  id: string | null;
  name: string;
  address: string;
  serves: string;
  lat: number | null;
  lng: number | null;
};

const emptyDraft: Draft = { id: null, name: "", address: "", serves: "", lat: null, lng: null };

const center: [number, number] = [-11.664, 27.482];

function slug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "arret";
}

function uniqueId(name: string, stops: TaxiStop[]) {
  const base = slug(name);
  let id = base;
  let count = 2;
  while (stops.some((stop) => stop.id === id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

function MapClick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Focus({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.panTo(point);
  }, [map, point]);
  return null;
}

export function StopEditor({ token }: { token: string }) {
  const [stops, setStops] = useState<TaxiStop[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Chargement des arrêts…");
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [relocating, setRelocating] = useState(false);
  const draftRef = useRef(draft);
  const lookupId = useRef(0);
  draftRef.current = draft;

  useEffect(() => {
    void load();
  }, [token]);

  async function load() {
    const response = await fetch("/api/stops", { headers: { "x-editor-token": token } });
    const data = (await response.json()) as { stops?: TaxiStop[]; error?: string };
    if (!response.ok || !data.stops) {
      setError(data.error ?? "Impossible de lire les arrêts.");
      return;
    }
    setStops(data.stops);
    setStatus("Clique sur Nouvel arrêt, puis pose le point sur la carte.");
  }

  async function fillAddress(lat: number, lng: number, updating: boolean) {
    const ticket = ++lookupId.current;
    setLookingUp(true);
    setStatus("Recherche de la nouvelle adresse…");
    try {
      const response = await fetch(`/api/address?lat=${lat}&lng=${lng}`);
      const data = (await response.json()) as { address?: string; error?: string };
      if (ticket !== lookupId.current) return;
      if (!response.ok || !data.address) {
        setError(data.error ?? "L’adresse de ce point est introuvable.");
        setStatus(
          updating
            ? "Nouvelle adresse introuvable. Complète-la, puis enregistre."
            : "Complète l’adresse si besoin, puis rédige le nom et la description.",
        );
        return;
      }
      setDraft((current) =>
        current && current.lat === lat && current.lng === lng ? { ...current, address: data.address ?? "" } : current,
      );
      setStatus(
        updating
          ? "Nouvelle adresse récupérée. Enregistre pour l’appliquer."
          : "Adresse récupérée. Rédige le nom et la description, puis enregistre.",
      );
    } catch {
      if (ticket !== lookupId.current) return;
      setError("Le service d’adresse ne répond pas.");
      setStatus("Tu peux saisir l’adresse à la main, puis enregistrer.");
    } finally {
      if (ticket === lookupId.current) setLookingUp(false);
    }
  }

  async function persist(next: TaxiStop[]) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/stops", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-editor-token": token },
        body: JSON.stringify({ stops: next }),
      });
      const data = (await response.json()) as { stops?: TaxiStop[]; error?: string };
      if (!response.ok || !data.stops) throw new Error(data.error ?? "Enregistrement impossible.");
      setStops(data.stops);
      setStatus("Arrêt enregistré. Gemma s’en sert dès la prochaine question.");
      return data.stops;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function startNewStop() {
    lookupId.current += 1;
    setLookingUp(false);
    setRelocating(false);
    setError(null);
    setFocus(null);
    setDraft(emptyDraft);
    setStatus("Mode édition : pose le point de l’arrêt sur la carte.");
  }

  function place(lat: number, lng: number) {
    const current = draftRef.current;
    if (!current) {
      setStatus("Choisis un arrêt, ou clique sur Nouvel arrêt, puis pose le point.");
      return;
    }
    const updating = current.id != null;
    setError(null);
    setRelocating(false);
    setFocus([lat, lng]);
    const next = { ...current, lat, lng, address: "" };
    draftRef.current = next;
    setDraft(next);
    void fillAddress(lat, lng, updating);
  }

  function selectStop(stop: TaxiStop) {
    lookupId.current += 1;
    setLookingUp(false);
    setError(null);
    const next: Draft = {
      id: stop.id,
      name: stop.name,
      address: stop.address,
      serves: stop.serves,
      lat: stop.lat,
      lng: stop.lng,
    };
    draftRef.current = next;
    setDraft(next);
    setRelocating(true);
    setFocus([stop.lat, stop.lng]);
    setStatus("Arrêt sélectionné. Indique son nouveau point sur la carte pour récupérer l’adresse.");
  }

  function useMyPosition() {
    if (!draftRef.current) {
      setStatus("Clique sur Nouvel arrêt, puis utilise ta position.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Ce navigateur ne donne pas la position.");
      return;
    }
    setStatus("Lecture de ta position…");
    navigator.geolocation.getCurrentPosition(
      (position) => place(position.coords.latitude, position.coords.longitude),
      () => setError("Localisation refusée."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function saveDraft() {
    if (!draft) return;
    if (draft.lat == null || draft.lng == null) {
      setError("Pose d’abord le point de l’arrêt sur la carte.");
      return;
    }
    const name = draft.name.trim();
    const address = draft.address.trim();
    const serves = draft.serves.trim();
    if (!name || !serves) {
      setError("Le nom et la description sont nécessaires.");
      return;
    }
    if (!address) {
      setError("L’adresse n’a pas été trouvée. Complète-la ou repose le point.");
      return;
    }
    const lat = draft.lat;
    const lng = draft.lng;
    const id = draft.id ?? uniqueId(name, stops.filter((stop) => stop.id !== draft.id));
    const nextStop: TaxiStop = { id, name, address, serves, lat, lng };
    const next = draft.id
      ? stops.map((stop) => (stop.id === draft.id ? nextStop : stop))
      : [...stops, nextStop];
    const saved = await persist(next);
    if (saved) setDraft({ ...nextStop, id: nextStop.id });
  }

  async function removeDraft() {
    if (!draft?.id) {
      setDraft(null);
      return;
    }
    const saved = await persist(stops.filter((stop) => stop.id !== draft.id));
    if (saved) setDraft(null);
  }

  const markers = useMemo(() => {
    return stops.map((stop) =>
      draft?.id === stop.id && draft.lat != null && draft.lng != null
        ? { ...stop, lat: draft.lat, lng: draft.lng }
        : stop,
    );
  }, [stops, draft]);

  const placing = draft != null && draft.lat == null;
  const mapHint = placing
    ? "Pose le point de l’arrêt sur la carte."
    : relocating
      ? "Indique le nouveau point pour mettre à jour l’adresse."
      : null;

  return (
    <div className="h-full overflow-y-auto lg:grid lg:grid-cols-[24rem_1fr] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 lg:overflow-y-auto lg:border-r lg:border-b-0 dark:border-zinc-800">
        <div>
          <p className="text-sm tracking-wide text-zinc-500 uppercase">Lubumbashi</p>
          <h1 className="text-2xl font-semibold tracking-tight">Arrêts de taxi</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{status}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={startNewStop}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Nouvel arrêt
          </button>
          <button
            type="button"
            onClick={useMyPosition}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Ma position
          </button>
        </div>

        {draft ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDraft();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Nom
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Description
              <textarea
                value={draft.serves}
                onChange={(event) => setDraft({ ...draft, serves: event.target.value })}
                rows={3}
                placeholder="Ce que cet arrêt dessert"
                className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Adresse
              <input
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                placeholder={lookingUp ? "Recherche de l’adresse…" : "Remplie quand tu poses le point"}
                className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              />
            </label>
            <p className="font-mono text-xs text-zinc-500">
              {draft.lat != null && draft.lng != null
                ? `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
                : "Point pas encore posé"}
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => void removeDraft()}
                className="rounded-full px-4 py-2 text-sm text-red-700 dark:text-red-300"
              >
                Retirer
              </button>
            </div>
          </form>
        ) : null}

        {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      </aside>

      <div className={`relative h-96 shrink-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-full ${mapHint ? "is-placing" : ""}`}>
        {mapHint ? (
          <p className="pointer-events-none absolute top-3 left-1/2 z-[500] max-w-[18rem] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-center text-sm text-white shadow-lg">
            {mapHint}
          </p>
        ) : null}
        <MapContainer center={center} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClick onPick={place} />
          <Focus point={focus} />
          {markers.map((stop) => (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={taxiMarkerIcon(draft?.id === stop.id)}
              draggable
              eventHandlers={{
                click: (event) => {
                  L.DomEvent.stopPropagation(event.originalEvent);
                  const current = stops.find((item) => item.id === stop.id);
                  if (current) selectStop(current);
                },
                dragend: (event) => {
                  const latlng = event.target.getLatLng() as { lat: number; lng: number };
                  const current = stops.find((item) => item.id === stop.id);
                  if (!current) return;
                  setRelocating(false);
                  setFocus([latlng.lat, latlng.lng]);
                  const next: Draft =
                    draftRef.current?.id === stop.id
                      ? { ...draftRef.current, lat: latlng.lat, lng: latlng.lng, address: "" }
                      : {
                          id: current.id,
                          name: current.name,
                          address: "",
                          serves: current.serves,
                          lat: latlng.lat,
                          lng: latlng.lng,
                        };
                  draftRef.current = next;
                  setDraft(next);
                  void fillAddress(latlng.lat, latlng.lng, true);
                },
              }}
            />
          ))}
          {draft && draft.id === null && draft.lat != null && draft.lng != null ? (
            <Marker
              position={[draft.lat, draft.lng]}
              icon={taxiMarkerIcon(true)}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const latlng = event.target.getLatLng() as { lat: number; lng: number };
                  place(latlng.lat, latlng.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>

      <ul className="flex flex-col gap-2 px-4 py-4 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto">
        {stops.map((stop) => (
          <li key={stop.id}>
            <button
              type="button"
              onClick={() => selectStop(stop)}
              className={`w-full rounded-xl px-3 py-2 text-left ${
                draft?.id === stop.id ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <span className="block font-medium">{stop.name}</span>
              <span className="block text-sm text-zinc-500">{stop.address}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
