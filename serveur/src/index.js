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
if (remplirDemo(db)) console.log('Comptes de démonstration créés (mot de passe : demo1234).');

const fournisseurs = fournisseursDepuisEnv();
const urlPublique = process.env.URL_PUBLIQUE?.replace(/\/$/, '');
for (const f of Object.values(fournisseurs)) {
  console.log(`Paiement ${f.nom} : ${f.simulation ? 'SIMULATION (aucune clé configurée)' : 'RÉEL'}`);
  if (!f.simulation && !urlPublique) {
    console.warn(`  ⚠️  Définissez URL_PUBLIQUE (https://…) pour les retours et notifications ${f.nom}.`);
  }
}

const app = creerApp({ db, jetons: creerJetons(dossierDonnees), fournisseurs, urlPublique });
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
