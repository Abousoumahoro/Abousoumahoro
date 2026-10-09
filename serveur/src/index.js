import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { avancerLivraisons, creerApp } from './app.js';
import { ouvrirBase, remplirDemo } from './db.js';
import { fournisseursDepuisEnv } from './fournisseurs.js';
import { verifierPaiementsEnAttente } from './paiements.js';
import { creerJetons } from './securite.js';

const PORT = Number(process.env.PORT) || 3000;
// Durée simulée d'un trajet A → B (secondes), pour les livreurs sans GPS réel.
const DUREE_TRAJET_S = Number(process.env.DUREE_TRAJET_S) || 60;

const dossierDonnees =
  process.env.DOSSIER_DONNEES || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'donnees');
fs.mkdirSync(dossierDonnees, { recursive: true });
const db = ouvrirBase(path.join(dossierDonnees, 'livraison.db'));
// Les comptes de démo (mot de passe connu) ne sont jamais créés en production, sauf DEMO=1.
const production = process.env.NODE_ENV === 'production';
if ((!production || process.env.DEMO === '1') && remplirDemo(db)) {
  console.log('Comptes de démonstration créés (mot de passe : demo1234).');
}
if (production && !process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET non défini : un secret a été généré dans le dossier des données.');
}

// Paiements simulés (Wave/Orange sans clés, carte) : seulement hors production, ou avec DEMO=1.
const simulationAutorisee = !production || process.env.DEMO === '1';
const fournisseurs = fournisseursDepuisEnv(process.env, { simulationAutorisee });
const urlPublique = process.env.URL_PUBLIQUE?.replace(/\/$/, '');
for (const f of Object.values(fournisseurs)) {
  const mode = f.simulation ? 'SIMULATION (aucune clé configurée)' : f.indisponible ? 'DÉSACTIVÉ (clés manquantes)' : 'RÉEL';
  console.log(`Paiement ${f.nom} : ${mode}`);
  if (!f.simulation && !f.indisponible && !urlPublique) {
    console.warn(`  ⚠️  Définissez URL_PUBLIQUE (https://…) pour les retours et notifications ${f.nom}.`);
  }
}

const app = creerApp({
  db,
  jetons: creerJetons(dossierDonnees),
  fournisseurs,
  urlPublique,
  carteSimulee: simulationAutorisee,
});
setInterval(() => avancerLivraisons(db, 1 / DUREE_TRAJET_S), 1000);
// Filet de sécurité si une notification de paiement se perd.
let verificationEnCours = false;
setInterval(async () => {
  if (verificationEnCours) return;
  verificationEnCours = true;
  try {
    await verifierPaiementsEnAttente(db, fournisseurs);
  } finally {
    verificationEnCours = false;
  }
}, 30_000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  → http://${i.address}:${PORT}`);
    }
  }
});
