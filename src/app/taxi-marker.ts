import L from "leaflet";

function taxiSvg(fill: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true">
    <path d="M18 42.5s13.5-12.6 13.5-22.2C31.5 12 25.4 6 18 6S4.5 12 4.5 20.3C4.5 29.9 18 42.5 18 42.5z" fill="${fill}" stroke="#fff" stroke-width="2"/>
    <g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 22.5h16l-1.6 4.2H11.6z"/>
      <path d="M12.2 22.5 14 18h8l1.8 4.5"/>
      <path d="M14.6 18v-1.6h6.8V18"/>
    </g>
    <circle cx="13.2" cy="27.4" r="1.15" fill="#111"/>
    <circle cx="22.8" cy="27.4" r="1.15" fill="#111"/>
    <rect x="15.2" y="14.2" width="5.6" height="2.3" rx="0.6" fill="#facc15"/>
  </svg>`;
}

export function taxiMarkerIcon(selected: boolean) {
  return L.divIcon({
    className: "gemma-taxi",
    html: taxiSvg(selected ? "#1d4ed8" : "#ea580c"),
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}
