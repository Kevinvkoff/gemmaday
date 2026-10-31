const lubumbashi = {
  minLat: -12.2,
  maxLat: -11.2,
  minLng: 27.2,
  maxLng: 27.9,
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
};

function formatAddress(address: NominatimAddress | undefined, displayName: string | undefined) {
  const street = [address?.house_number, address?.road || address?.pedestrian || address?.footway]
    .filter(Boolean)
    .join(" ");
  const area = address?.neighbourhood || address?.suburb || address?.quarter || address?.city_district;
  const city = address?.city || address?.town || address?.municipality || "Lubumbashi";
  const parts = [street, area, city].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return displayName?.split(",").slice(0, 3).join(",").trim() ?? "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Coordonnées invalides." }, { status: 400 });
  }
  if (lat < lubumbashi.minLat || lat > lubumbashi.maxLat || lng < lubumbashi.minLng || lng > lubumbashi.maxLng) {
    return Response.json({ error: "Ce point est en dehors de Lubumbashi." }, { status: 400 });
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("lat", String(lat));
  endpoint.searchParams.set("lon", String(lng));
  endpoint.searchParams.set("accept-language", "fr");
  endpoint.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "gemmaday/0.1 (https://github.com/Likeur/gemmaday)",
        "Accept-Language": "fr",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return Response.json({ error: "L’adresse de ce point est introuvable." }, { status: 502 });
    }
    const data = (await response.json()) as { address?: NominatimAddress; display_name?: string; error?: string };
    const address = formatAddress(data.address, data.display_name);
    if (!address) {
      return Response.json({ error: "L’adresse de ce point est introuvable." }, { status: 404 });
    }
    return Response.json({ address });
  } catch {
    return Response.json({ error: "Le service d’adresse ne répond pas." }, { status: 502 });
  }
}
