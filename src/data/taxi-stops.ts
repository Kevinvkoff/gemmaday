export type TaxiStop = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  serves: string;
};

// Coordonnées OpenStreetMap (Nominatim), octobre 2026.
// Ce sont des arrêts repères : le point où l’on monte dans un taxi pour une direction,
// pas un registre officiel de la ville.
export const taxiStops: TaxiStop[] = [
  {
    id: "poste",
    name: "Poste de Lubumbashi",
    address: "Avenue Jason Sendwe, centre-ville",
    lat: -11.66637,
    lng: 27.4858,
    serves:
      "départ du centre vers Kenya, Katuba, Kamalondo, Kampemba, Ruashi, Golf, Bel-Air, Industriel, l’université, l’aéroport et l’hôpital Sendwe",
  },
  {
    id: "hotel-de-ville",
    name: "Hôtel de Ville",
    address: "Hôtel de Ville de Lubumbashi, Cercle de Lubumbashi",
    lat: -11.66341,
    lng: 27.48288,
    serves: "centre-ville, même desserte que la Poste quand la personne est déjà côté Hôtel de Ville",
  },
  {
    id: "kenya",
    name: "Marché Kenya",
    address: "Marché 1 de la Kenya, Avenue Basilique, Mampala",
    lat: -11.6991,
    lng: 27.48165,
    serves: "marché Kenya, commune Kenya, terminus sud",
  },
  {
    id: "kamalondo",
    name: "Marché de Kamalondo",
    address: "Avenue Luano, Kamalondo",
    lat: -11.68121,
    lng: 27.48742,
    serves: "commune Kamalondo et son marché",
  },
  {
    id: "katuba",
    name: "Terminus Katuba",
    address: "Avenue Upemba, Katuba",
    lat: -11.69381,
    lng: 27.45946,
    serves: "commune Katuba, foyer et avenue Upemba",
  },
  {
    id: "sendwe",
    name: "Hôpital Sendwe",
    address: "Hôpital Jason Sendwe, Avenue Jason Sendwe",
    lat: -11.67281,
    lng: 27.48801,
    serves: "hôpital Jason Sendwe",
  },
  {
    id: "unilu",
    name: "Université de Lubumbashi",
    address: "Avenue Polytechnique Prolongée",
    lat: -11.61273,
    lng: 27.48103,
    serves: "campus de l’Université de Lubumbashi, UNILU",
  },
  {
    id: "aeroport",
    name: "Aéroport de Lubumbashi",
    address: "Aéroport international de la Luano, route de l’aéroport",
    lat: -11.59265,
    lng: 27.52592,
    serves: "aéroport de la Luano, départs et arrivées",
  },
  {
    id: "golf",
    name: "Quartier Golf",
    address: "Quartier Golf, ouest de Lubumbashi",
    lat: -11.64606,
    lng: 27.45071,
    serves: "quartier Golf",
  },
  {
    id: "ruashi",
    name: "Commune Ruashi",
    address: "Bureau de la commune, Avenue Unazai, Ruashi",
    lat: -11.63708,
    lng: 27.53963,
    serves: "commune Ruashi",
  },
  {
    id: "kampemba",
    name: "Kampemba",
    address: "Naviundu, Kampemba",
    lat: -11.68304,
    lng: 27.5521,
    serves: "commune Kampemba",
  },
  {
    id: "bel-air",
    name: "Bel-Air",
    address: "Bel-Air 2, Kampemba",
    lat: -11.66515,
    lng: 27.50375,
    serves: "quartier Bel-Air",
  },
  {
    id: "industriel",
    name: "Quartier Industriel",
    address: "Quartier Industriel, Kampemba",
    lat: -11.64084,
    lng: 27.49025,
    serves: "quartier Industriel, étape vers Annexe",
  },
];

export function findTaxiStop(id: string | null | undefined) {
  if (!id) return null;
  return taxiStops.find((stop) => stop.id === id) ?? null;
}

export function taxiStopCatalog() {
  return taxiStops
    .map((stop) => `${stop.id} | ${stop.name} | ${stop.address} | ${stop.serves}`)
    .join("\n");
}
