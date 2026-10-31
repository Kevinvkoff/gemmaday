type Point = { lat: number; lng: number };

function parsePoint(value: string | null): Point | null {
  if (!value) return null;
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parsePoint(url.searchParams.get("from"));
  const to = parsePoint(url.searchParams.get("to"));
  if (!from || !to) {
    return Response.json(
      { error: "Paramètres from et to attendus au format lat,lng." },
      { status: 400 },
    );
  }

  const endpoint = new URL(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
  );
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("geometries", "geojson");

  let payload: {
    code?: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      return Response.json({ error: "Le calcul d’itinéraire a échoué." }, { status: 502 });
    }
    payload = await response.json();
  } catch {
    return Response.json({ error: "Le service d’itinéraire ne répond pas." }, { status: 502 });
  }

  const route = payload.routes?.[0];
  if (!route) {
    return Response.json({ error: "Aucun itinéraire routier entre ces deux points." }, { status: 404 });
  }

  return Response.json({
    distance: route.distance,
    duration: route.duration,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  });
}
