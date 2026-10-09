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

CREATE TABLE IF NOT EXISTS commandes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  commercant_id INTEGER NOT NULL REFERENCES utilisateurs(id),
  livreur_id INTEGER REFERENCES utilisateurs(id),
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'verification', 'en_cours', 'livree')),
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
  db.exec(SCHEMA);
  return db;
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
