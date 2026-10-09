export function formatPrix(montant) {
  return `${montant.toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Distance en km entre deux points GPS (formule de Haversine).
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Position du livreur entre A et B selon la progression (0 → 1).
export function positionSurTrajet(depart, arrivee, progression) {
  return {
    latitude: depart.latitude + (arrivee.latitude - depart.latitude) * progression,
    longitude: depart.longitude + (arrivee.longitude - depart.longitude) * progression,
  };
}
