import { envoyerPush } from './push.js';

// Rayon (km) dans lequel un colis est proposé au livreur.
export const RAYON_KM = 15;

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

// Enregistre la notification (onglet « Notifications ») et l'envoie en push sur le téléphone.
export function notifier(db, utilisateurIds, message) {
  const ids = [...new Set(utilisateurIds.filter(Boolean))];
  const st = db.prepare('INSERT INTO notifications (utilisateur_id, message) VALUES (?, ?)');
  for (const id of ids) st.run(id, message);
  envoyerPush(db, ids, message);
}

// Prévient le commerçant et les livreurs proches qu'une commande est prête à être livrée.
export function annoncerCommande(db, commande, detail) {
  notifier(db, [commande.commercant_id], `Nouvelle commande #${commande.id} ${detail}.`);
  const depart = { latitude: commande.depart_lat, longitude: commande.depart_lng };
  const livreurs = db.prepare("SELECT id, latitude, longitude FROM utilisateurs WHERE role = 'livreur'").all();
  notifier(
    db,
    livreurs.filter((l) => distanceKm(l, depart) <= RAYON_KM).map((l) => l.id),
    `Nouveau colis disponible près de vous : #${commande.id}.`,
  );
}
