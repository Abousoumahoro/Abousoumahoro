import express from 'express';
import { creerUtilisateur } from './db.js';
import { QUARTIERS, quartierParId } from './quartiers.js';
import { annoncerCommande, distanceKm, notifier, RAYON_KM } from './outils.js';
import { demarrerPaiement, paiementPublic, routesPaiement, verifierPaiement, appliquerResultat } from './paiements.js';
import { normaliserTelephone, verifierMotDePasse } from './securite.js';

export const FRAIS_LIVRAISON = 1000;
const PAIEMENT_MOBILE = ['orange', 'wave'];
const ROLES = ['client', 'livreur', 'commercant'];
const CATEGORIES = ['repas', 'courses', 'divers'];
const PAIEMENTS = ['carte', 'orange', 'wave', 'livraison'];

class ErreurApi extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}
const echec = (statut, message) => {
  throw new ErreurApi(statut, message);
};

const dateIso = (d) => (d ? `${d.replace(' ', 'T')}Z` : null);

function profilPublic(u) {
  return {
    id: u.id,
    role: u.role,
    nom: u.nom,
    telephone: u.telephone,
    nomBoutique: u.nom_boutique,
    vehicule: u.vehicule,
    quartier: u.quartier,
    adresse: u.adresse,
    position: { latitude: u.latitude, longitude: u.longitude },
  };
}

function produitPublic(p) {
  return {
    id: p.id,
    commercantId: p.commercant_id,
    commercant: p.nom_boutique,
    nom: p.nom,
    prix: p.prix,
    categorie: p.categorie,
    description: p.description,
  };
}

function commandeComplete(db, c) {
  const u = (id) => (id ? db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(id) : null);
  const commercant = u(c.commercant_id);
  const client = u(c.client_id);
  const livreur = u(c.livreur_id);
  const articles = db
    .prepare('SELECT produit_id, nom, prix, quantite FROM lignes_commande WHERE commande_id = ? ORDER BY id')
    .all(c.id)
    .map((l) => ({ produitId: l.produit_id, nom: l.nom, prix: l.prix, quantite: l.quantite }));
  return {
    id: c.id,
    statut: c.statut,
    paiement: c.paiement,
    statutPaiement: c.statut_paiement,
    total: c.total,
    fraisLivraison: c.frais_livraison,
    adresseLivraison: c.adresse_livraison,
    depart: { latitude: c.depart_lat, longitude: c.depart_lng },
    arrivee: { latitude: c.arrivee_lat, longitude: c.arrivee_lng },
    progression: c.progression,
    positionLivreur: c.livreur_lat != null ? { latitude: c.livreur_lat, longitude: c.livreur_lng } : null,
    date: dateIso(c.cree_le),
    articles,
    commercant: {
      id: commercant.id,
      nom: commercant.nom_boutique,
      adresse: commercant.adresse,
      telephone: commercant.telephone,
    },
    client: { nom: client.nom, telephone: client.telephone },
    livreur: livreur && { nom: livreur.nom, telephone: livreur.telephone, vehicule: livreur.vehicule },
  };
}

// urlPublique : adresse internet du serveur (obligatoire avec les vraies clés Orange / Wave,
// pour les pages de retour et les notifications). Sinon : l'adresse utilisée par le téléphone.
export function creerApp({ db, jetons, fournisseurs, urlPublique }) {
  const app = express();
  // Le corps brut est gardé pour vérifier la signature des notifications Wave.
  app.use(express.json({ verify: (req, _res, buf) => { req.corpsBrut = buf; } }));
  const adresse = (req) => urlPublique || `${req.protocol}://${req.get('host')}`;

  const authentifier = (...roles) => (req, _res, next) => {
    const entete = req.get('authorization') || '';
    const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
    if (!jeton) echec(401, 'Connexion requise');
    let charge;
    try {
      charge = jetons.verifier(jeton);
    } catch {
      echec(401, 'Session expirée, reconnectez-vous');
    }
    const utilisateur = db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(charge.id);
    if (!utilisateur) echec(401, 'Compte introuvable');
    if (roles.length && !roles.includes(utilisateur.role)) echec(403, 'Accès refusé pour ce profil');
    req.utilisateur = utilisateur;
    next();
  };

  app.get('/sante', (_req, res) => res.json({ ok: true }));
  app.get('/quartiers', (_req, res) => res.json(QUARTIERS));

  // ---------- Comptes ----------
  app.post('/auth/inscription', (req, res) => {
    const b = req.body || {};
    const telephone = normaliserTelephone(b.telephone);
    if (!ROLES.includes(b.role)) echec(400, 'Profil invalide');
    if (!b.nom?.trim()) echec(400, 'Le nom est obligatoire');
    if (telephone.replace('+', '').length < 8) echec(400, 'Numéro de téléphone invalide');
    if (!b.motDePasse || b.motDePasse.length < 6) echec(400, 'Mot de passe : 6 caractères minimum');
    if (!quartierParId(b.quartier)) echec(400, 'Choisissez votre quartier');
    if (b.role === 'commercant' && !b.nomBoutique?.trim()) echec(400, 'Le nom de la boutique est obligatoire');
    if (b.role === 'livreur' && !b.vehicule?.trim()) echec(400, 'Le véhicule est obligatoire');
    if (db.prepare('SELECT 1 FROM utilisateurs WHERE telephone = ?').get(telephone)) {
      echec(409, 'Un compte existe déjà avec ce numéro');
    }
    const id = creerUtilisateur(db, {
      role: b.role,
      nom: b.nom.trim(),
      telephone,
      motDePasse: b.motDePasse,
      nomBoutique: b.nomBoutique?.trim(),
      vehicule: b.vehicule?.trim(),
      quartier: b.quartier,
      adresse: b.adresse?.trim(),
    });
    const u = db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(id);
    notifier(db, [id], `Bienvenue ${u.nom} ! Votre compte est créé.`);
    res.status(201).json({ jeton: jetons.signer(u), utilisateur: profilPublic(u) });
  });

  app.post('/auth/connexion', (req, res) => {
    const telephone = normaliserTelephone(req.body?.telephone);
    const u = db.prepare('SELECT * FROM utilisateurs WHERE telephone = ?').get(telephone);
    if (!u || !verifierMotDePasse(String(req.body?.motDePasse || ''), u.mot_de_passe)) {
      echec(401, 'Téléphone ou mot de passe incorrect');
    }
    res.json({ jeton: jetons.signer(u), utilisateur: profilPublic(u) });
  });

  app.get('/moi', authentifier(), (req, res) => res.json(profilPublic(req.utilisateur)));

  // ---------- Articles ----------
  const SELECT_PRODUITS = `SELECT p.*, u.nom_boutique FROM produits p
    JOIN utilisateurs u ON u.id = p.commercant_id WHERE p.actif = 1`;

  app.get('/produits', authentifier(), (req, res) => {
    const { categorie } = req.query;
    const lignes = categorie
      ? db.prepare(`${SELECT_PRODUITS} AND p.categorie = ? ORDER BY p.id DESC`).all(categorie)
      : db.prepare(`${SELECT_PRODUITS} ORDER BY p.id DESC`).all();
    res.json(lignes.map(produitPublic));
  });

  app.get('/mes-produits', authentifier('commercant'), (req, res) => {
    const lignes = db
      .prepare(`${SELECT_PRODUITS} AND p.commercant_id = ? ORDER BY p.id DESC`)
      .all(req.utilisateur.id);
    res.json(lignes.map(produitPublic));
  });

  app.post('/produits', authentifier('commercant'), (req, res) => {
    const b = req.body || {};
    const prix = Number(b.prix);
    if (!b.nom?.trim()) echec(400, 'Le nom de l\'article est obligatoire');
    if (!Number.isInteger(prix) || prix <= 0) echec(400, 'Prix invalide');
    if (!CATEGORIES.includes(b.categorie)) echec(400, 'Catégorie invalide');
    const r = db
      .prepare('INSERT INTO produits (commercant_id, nom, prix, categorie, description) VALUES (?, ?, ?, ?, ?)')
      .run(req.utilisateur.id, b.nom.trim(), prix, b.categorie, (b.description || '').trim());
    const p = db.prepare(`${SELECT_PRODUITS} AND p.id = ?`).get(Number(r.lastInsertRowid));
    res.status(201).json(produitPublic(p));
  });

  app.delete('/produits/:id', authentifier('commercant'), (req, res) => {
    const r = db
      .prepare('UPDATE produits SET actif = 0 WHERE id = ? AND commercant_id = ?')
      .run(Number(req.params.id), req.utilisateur.id);
    if (r.changes === 0) echec(404, 'Article introuvable');
    res.status(204).end();
  });

  // ---------- Commandes ----------
  // Le client envoie son panier ; le serveur recalcule les prix et crée
  // une commande par commerçant (chaque commerçant = un point de départ A).
  app.post('/commandes', authentifier('client'), async (req, res) => {
    const client = req.utilisateur;
    const { articles, paiement } = req.body || {};
    if (!PAIEMENTS.includes(paiement)) echec(400, 'Moyen de paiement invalide');
    if (!Array.isArray(articles) || articles.length === 0) echec(400, 'Panier vide');

    const parCommercant = new Map();
    for (const a of articles) {
      const quantite = Number(a.quantite);
      if (!Number.isInteger(quantite) || quantite <= 0) echec(400, 'Quantité invalide');
      const p = db.prepare('SELECT * FROM produits WHERE id = ? AND actif = 1').get(Number(a.produitId));
      if (!p) echec(400, 'Un article du panier n\'est plus disponible');
      if (!parCommercant.has(p.commercant_id)) parCommercant.set(p.commercant_id, []);
      parCommercant.get(p.commercant_id).push({ p, quantite });
    }

    const mobile = PAIEMENT_MOBILE.includes(paiement);
    const creees = [];
    db.exec('BEGIN');
    try {
      for (const [commercantId, lignes] of parCommercant) {
        const m = db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(commercantId);
        const total = lignes.reduce((s, l) => s + l.p.prix * l.quantite, 0);
        const r = db
          .prepare(
            `INSERT INTO commandes (client_id, commercant_id, statut, paiement, total, frais_livraison, adresse_livraison,
               depart_lat, depart_lng, arrivee_lat, arrivee_lng)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(client.id, m.id, mobile ? 'attente_paiement' : 'en_attente', paiement, total, FRAIS_LIVRAISON, client.adresse,
            m.latitude, m.longitude, client.latitude, client.longitude);
        const id = Number(r.lastInsertRowid);
        const ligne = db.prepare(
          'INSERT INTO lignes_commande (commande_id, produit_id, nom, prix, quantite) VALUES (?, ?, ?, ?, ?)',
        );
        for (const l of lignes) ligne.run(id, l.p.id, l.p.nom, l.p.prix, l.quantite);
        creees.push(id);
        // Orange Money / Wave : la commande n'est visible des livreurs qu'une fois payée.
        if (mobile) continue;
        // Carte bancaire : encore simulée, considérée comme payée immédiatement.
        if (paiement === 'carte') {
          db.prepare("UPDATE commandes SET statut_paiement = 'paye' WHERE id = ?").run(id);
        }
        notifier(db, [client.id], `Commande #${id} enregistrée. Recherche d'un livreur…`);
        annoncerCommande(db, db.prepare('SELECT * FROM commandes WHERE id = ?').get(id), `: ${lignes.length} article(s)`);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    const lire = db.prepare('SELECT * FROM commandes WHERE id = ?');
    let paiementCree = null;
    if (mobile) {
      const montant = creees.reduce((s, id) => {
        const c = lire.get(id);
        return s + c.total + c.frais_livraison;
      }, 0);
      try {
        paiementCree = paiementPublic(
          await demarrerPaiement({
            db, fournisseurs, urlPublique: adresse(req), client, fournisseur: paiement, commandeIds: creees, montant,
          }),
        );
      } catch {
        echec(502, `Le paiement ${paiement === 'wave' ? 'Wave' : 'Orange Money'} est indisponible. Réessayez ou choisissez un autre moyen.`);
      }
    }
    res.status(201).json({
      commandes: creees.map((id) => commandeComplete(db, lire.get(id))),
      paiement: paiementCree,
    });
  });

  // ---------- Paiements Orange Money / Wave ----------
  const paiementDuClient = (req) => {
    const p = db.prepare('SELECT * FROM paiements WHERE id = ? AND client_id = ?').get(Number(req.params.id), req.utilisateur.id);
    if (!p) echec(404, 'Paiement introuvable');
    return p;
  };

  app.get('/paiements/:id', authentifier('client'), (req, res) => {
    res.json(paiementPublic(paiementDuClient(req)));
  });

  // « J'ai payé » : on redemande le statut au fournisseur.
  app.post('/paiements/:id/verifier', authentifier('client'), async (req, res) => {
    const p = paiementDuClient(req);
    res.json(paiementPublic(await verifierPaiement(db, fournisseurs, p.id)));
  });

  // Le client abandonne : on vérifie d'abord qu'il n'a pas déjà payé.
  app.post('/paiements/:id/annuler', authentifier('client'), async (req, res) => {
    const p = await verifierPaiement(db, fournisseurs, paiementDuClient(req).id);
    if (p.statut === 'en_attente') appliquerResultat(db, p.id, 'echoue');
    res.json(paiementPublic(db.prepare('SELECT * FROM paiements WHERE id = ?').get(p.id)));
  });

  // Chacun ne voit que ses propres commandes.
  const COLONNE_ROLE = { client: 'client_id', commercant: 'commercant_id', livreur: 'livreur_id' };

  app.get('/commandes', authentifier(), (req, res) => {
    const col = COLONNE_ROLE[req.utilisateur.role];
    // Le commerçant ne voit une commande Orange Money / Wave qu'une fois payée.
    const filtre =
      req.utilisateur.role === 'commercant' ? "AND statut NOT IN ('attente_paiement', 'annulee')" : '';
    const lignes = db
      .prepare(`SELECT * FROM commandes WHERE ${col} = ? ${filtre} ORDER BY id DESC`)
      .all(req.utilisateur.id);
    res.json(lignes.map((c) => commandeComplete(db, c)));
  });

  const commandeAccessible = (req) => {
    const c = db.prepare('SELECT * FROM commandes WHERE id = ?').get(Number(req.params.id));
    const u = req.utilisateur;
    const autorise =
      c &&
      (c[COLONNE_ROLE[u.role]] === u.id || (u.role === 'livreur' && c.statut === 'en_attente'));
    if (!autorise) echec(404, 'Commande introuvable');
    return c;
  };

  app.get('/commandes/:id', authentifier(), (req, res) => {
    res.json(commandeComplete(db, commandeAccessible(req)));
  });

  // ---------- Livreur ----------
  app.get('/livreur/colis-proches', authentifier('livreur'), (req, res) => {
    const moi = req.utilisateur;
    const proches = db
      .prepare("SELECT * FROM commandes WHERE statut = 'en_attente' ORDER BY id")
      .all()
      .map((c) => ({
        ...commandeComplete(db, c),
        distance: distanceKm(moi, { latitude: c.depart_lat, longitude: c.depart_lng }),
      }))
      .filter((c) => c.distance <= RAYON_KM)
      .sort((a, b) => a.distance - b.distance);
    res.json(proches);
  });

  // Prendre un ou plusieurs colis.
  app.post('/livreur/accepter', authentifier('livreur'), (req, res) => {
    const ids = (req.body?.ids || []).map(Number);
    if (ids.length === 0) echec(400, 'Aucun colis sélectionné');
    const acceptes = [];
    for (const id of ids) {
      const r = db
        .prepare(
          "UPDATE commandes SET livreur_id = ?, statut = 'verification' WHERE id = ? AND statut = 'en_attente'",
        )
        .run(req.utilisateur.id, id);
      if (r.changes === 0) continue; // déjà pris par un autre livreur
      acceptes.push(id);
      const c = db.prepare('SELECT * FROM commandes WHERE id = ?').get(id);
      notifier(db, [c.client_id, c.commercant_id], `${req.utilisateur.nom} a accepté le colis #${id}.`);
    }
    res.json({ acceptes, dejaPris: ids.filter((id) => !acceptes.includes(id)) });
  });

  // Vérification obligatoire de l'intérieur du colis avant le départ.
  app.post('/commandes/:id/verification', authentifier('livreur'), (req, res) => {
    const c = commandeAccessible(req);
    if (c.statut !== 'verification') echec(409, 'Ce colis n\'est pas en attente de vérification');
    const verifies = new Set((req.body?.articlesVerifies || []).map(Number));
    const lignes = db.prepare('SELECT produit_id FROM lignes_commande WHERE commande_id = ?').all(c.id);
    if (!lignes.every((l) => verifies.has(l.produit_id)) || req.body?.interieurOk !== true) {
      echec(400, 'Vérifiez chaque article et l\'intérieur du colis avant de partir');
    }
    db.prepare(
      "UPDATE commandes SET statut = 'en_cours', livreur_lat = depart_lat, livreur_lng = depart_lng WHERE id = ?",
    ).run(c.id);
    notifier(db, [c.client_id, c.commercant_id], `Colis #${c.id} vérifié. Le livreur est en route !`);
    res.json(commandeComplete(db, db.prepare('SELECT * FROM commandes WHERE id = ?').get(c.id)));
  });

  // Position GPS réelle du livreur (prévu pour expo-location).
  app.post('/livreur/position', authentifier('livreur'), (req, res) => {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) echec(400, 'Position invalide');
    db.prepare('UPDATE utilisateurs SET latitude = ?, longitude = ? WHERE id = ?')
      .run(latitude, longitude, req.utilisateur.id);
    db.prepare(
      "UPDATE commandes SET livreur_lat = ?, livreur_lng = ?, gps_reel = 1 WHERE livreur_id = ? AND statut = 'en_cours'",
    ).run(latitude, longitude, req.utilisateur.id);
    res.json({ ok: true });
  });

  // Le livreur confirme la remise du colis (utile avec le GPS réel).
  app.post('/commandes/:id/livree', authentifier('livreur'), (req, res) => {
    const c = commandeAccessible(req);
    if (c.statut !== 'en_cours') echec(409, 'Ce colis n\'est pas en cours de livraison');
    terminerLivraison(db, c);
    res.json(commandeComplete(db, db.prepare('SELECT * FROM commandes WHERE id = ?').get(c.id)));
  });

  // ---------- Notifications ----------
  app.get('/notifications', authentifier(), (req, res) => {
    const lignes = db
      .prepare('SELECT * FROM notifications WHERE utilisateur_id = ? ORDER BY id DESC LIMIT 100')
      .all(req.utilisateur.id);
    res.json(lignes.map((n) => ({ id: n.id, message: n.message, date: dateIso(n.cree_le) })));
  });

  app.use(routesPaiement({ db, fournisseurs }));

  app.use((_req, _res, next) => next(new ErreurApi(404, 'Route introuvable')));
  app.use((err, _req, res, _next) => {
    if (err instanceof ErreurApi) return res.status(err.statut).json({ erreur: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide' });
    console.error(err);
    res.status(500).json({ erreur: 'Erreur interne du serveur' });
  });

  return app;
}

export function terminerLivraison(db, c) {
  db.prepare(
    `UPDATE commandes SET statut = 'livree', progression = 1, statut_paiement = 'paye',
       livreur_lat = arrivee_lat, livreur_lng = arrivee_lng WHERE id = ?`,
  ).run(c.id);
  notifier(db, [c.client_id, c.commercant_id, c.livreur_id], `Colis #${c.id} livré ✅`);
}

// Simulation du trajet A → B pour les livreurs sans GPS réel (démo).
export function avancerLivraisons(db, pas) {
  const enCours = db.prepare("SELECT * FROM commandes WHERE statut = 'en_cours' AND gps_reel = 0").all();
  for (const c of enCours) {
    const progression = Math.min(1, c.progression + pas);
    if (progression >= 1) {
      terminerLivraison(db, c);
      continue;
    }
    db.prepare('UPDATE commandes SET progression = ?, livreur_lat = ?, livreur_lng = ? WHERE id = ?').run(
      progression,
      c.depart_lat + (c.arrivee_lat - c.depart_lat) * progression,
      c.depart_lng + (c.arrivee_lng - c.depart_lng) * progression,
      c.id,
    );
  }
}
