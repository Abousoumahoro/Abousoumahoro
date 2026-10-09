import { DatabaseSync } from 'node:sqlite';
import { quartierParId } from './quartiers.js';
import { hacherMotDePasse } from './securite.js';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('client', 'livreur', 'commercant')),
  nom TEXT NOT NULL,
  telephone TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  nom_boutique TEXT,
  vehicule TEXT,
  quartier TEXT NOT NULL,
  adresse TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS produits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commercant_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  nom TEXT NOT NULL,
  prix INTEGER NOT NULL CHECK (prix > 0),
  categorie TEXT NOT NULL CHECK (categorie IN ('repas', 'courses', 'divers')),
  description TEXT NOT NULL DEFAULT '',
  actif INTEGER NOT NULL DEFAULT 1,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un paiement Orange Money / Wave couvre tout le panier (une ou plusieurs commandes).
CREATE TABLE IF NOT EXISTS paiements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  fournisseur TEXT NOT NULL CHECK (fournisseur IN ('orange', 'wave')),
  montant INTEGER NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'reussi', 'echoue')),
  reference TEXT NOT NULL UNIQUE,
  reference_externe TEXT,
  secret TEXT NOT NULL,
  url TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commandes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  commercant_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  livreur_id INTEGER REFERENCES utilisateurs(id),
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('attente_paiement', 'en_attente', 'verification', 'en_cours', 'livree', 'annulee')),
  paiement_id INTEGER REFERENCES paiements(id),
  paiement TEXT NOT NULL CHECK (paiement IN ('carte', 'orange', 'wave', 'livraison')),
  statut_paiement TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut_paiement IN ('en_attente', 'paye')),
  total INTEGER NOT NULL,
  frais_livraison INTEGER NOT NULL,
  adresse_livraison TEXT NOT NULL,
  depart_lat REAL NOT NULL,
  depart_lng REAL NOT NULL,
  arrivee_lat REAL NOT NULL,
  arrivee_lng REAL NOT NULL,
  progression REAL NOT NULL DEFAULT 0,
  livreur_lat REAL,
  livreur_lng REAL,
  gps_reel INTEGER NOT NULL DEFAULT 0,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lignes_commande (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commande_id INTEGER NOT NULL REFERENCES commandes(id),
  produit_id INTEGER NOT NULL REFERENCES produits(id),
  nom TEXT NOT NULL,
  prix INTEGER NOT NULL,
  quantite INTEGER NOT NULL CHECK (quantite > 0)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  message TEXT NOT NULL,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function ouvrirBase(fichier) {
  const db = new DatabaseSync(fichier);
  migrerCommandes(db);
  db.exec(SCHEMA);
  return db;
}

// Bases créées avant le paiement mobile : on reconstruit la table « commandes »
// avec les nouveaux statuts et la colonne paiement_id, en gardant les données.
function migrerCommandes(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'commandes'").get();
  if (!table || table.sql.includes('paiement_id')) return;
  const colonnes = db.prepare('PRAGMA table_info(commandes)').all().map((c) => c.name).join(', ');
  db.exec('PRAGMA foreign_keys = OFF');
  // Empêche SQLite de réécrire les références de lignes_commande vers l'ancienne table.
  db.exec('PRAGMA legacy_alter_table = ON');
  db.exec('BEGIN');
  db.exec('ALTER TABLE commandes RENAME TO commandes_ancienne');
  db.exec(SCHEMA);
  db.exec(`INSERT INTO commandes (${colonnes}) SELECT ${colonnes} FROM commandes_ancienne`);
  db.exec('DROP TABLE commandes_ancienne');
  db.exec('COMMIT');
  db.exec('PRAGMA legacy_alter_table = OFF');
}

export function creerUtilisateur(db, u) {
  const q = quartierParId(u.quartier);
  const res = db
    .prepare(
      `INSERT INTO utilisateurs (role, nom, telephone, mot_de_passe, nom_boutique, vehicule, quartier, adresse, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      u.role,
      u.nom,
      u.telephone,
      hacherMotDePasse(u.motDePasse),
      u.nomBoutique ?? null,
      u.vehicule ?? null,
      q.id,
      u.adresse || q.nom,
      q.latitude,
      q.longitude,
    );
  return Number(res.lastInsertRowid);
}

// Comptes et articles de démonstration, créés uniquement si la base est vide.
export function remplirDemo(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM utilisateurs').get();
  if (n > 0) return false;
  const mdp = 'demo1234';
  const awa = creerUtilisateur(db, {
    role: 'commercant', nom: 'Awa Traoré', telephone: '0700000001', motDePasse: mdp,
    nomBoutique: 'Chez Tantie Awa', quartier: 'cocody-angre',
  });
  const superette = creerUtilisateur(db, {
    role: 'commercant', nom: 'Ibrahim Diallo', telephone: '0700000002', motDePasse: mdp,
    nomBoutique: 'Supérette du Plateau', quartier: 'plateau',
  });
  creerUtilisateur(db, {
    role: 'livreur', nom: 'Moussa Koné', telephone: '0100000020', motDePasse: mdp,
    vehicule: 'Moto — AB 1234 CI', quartier: 'adjame',
  });
  creerUtilisateur(db, {
    role: 'client', nom: 'Client démo', telephone: '0500000010', motDePasse: mdp,
    quartier: 'marcory-zone4',
  });
  const ajout = db.prepare(
    'INSERT INTO produits (commercant_id, nom, prix, categorie, description) VALUES (?, ?, ?, ?, ?)',
  );
  ajout.run(awa, 'Garba', 1000, 'repas', 'Attiéké + thon frit');
  ajout.run(awa, 'Alloco poulet', 2500, 'repas', 'Banane plantain frite et poulet braisé');
  ajout.run(awa, 'Jus de bissap (1L)', 800, 'repas', 'Fait maison');
  ajout.run(superette, 'Riz parfumé 5 kg', 4500, 'courses', 'Sac de 5 kg');
  ajout.run(superette, 'Huile 1L', 1500, 'courses', 'Huile végétale');
  ajout.run(superette, 'Chargeur USB-C', 3000, 'divers', 'Charge rapide 20W');
  return true;
}
