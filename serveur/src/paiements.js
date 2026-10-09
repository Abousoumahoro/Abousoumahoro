import crypto from 'node:crypto';
import express from 'express';
import { annoncerCommande, notifier } from './outils.js';

const NOMS = { orange: 'Orange Money', wave: 'Wave' };
const LOGOS = { orange: '/public/orange-money.png', wave: '/public/wave.png' };
const COULEURS = { orange: '#ff7900', wave: '#1dc8ff' };
// Un paiement non confirmé après ce délai est annulé.
export const EXPIRATION_MIN = 30;

export function paiementPublic(p) {
  return {
    id: p.id,
    fournisseur: p.fournisseur,
    montant: p.montant,
    statut: p.statut,
    url: p.url,
    simulation: p.simulation ?? undefined,
  };
}

const lire = (db, id) => db.prepare('SELECT * FROM paiements WHERE id = ?').get(id);

// Crée le paiement chez le fournisseur pour les commandes du panier.
export async function demarrerPaiement({ db, fournisseurs, urlPublique, client, fournisseur, commandeIds, montant }) {
  const f = fournisseurs[fournisseur];
  const reference = `LV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const secret = crypto.randomBytes(24).toString('hex');
  const r = db
    .prepare('INSERT INTO paiements (client_id, fournisseur, montant, reference, secret) VALUES (?, ?, ?, ?, ?)')
    .run(client.id, fournisseur, montant, reference, secret);
  const id = Number(r.lastInsertRowid);
  const lier = db.prepare('UPDATE commandes SET paiement_id = ? WHERE id = ?');
  for (const c of commandeIds) lier.run(id, c);

  try {
    const res = await f.creer({
      reference,
      montant,
      urlRetour: `${urlPublique}/paiements/${id}/retour`,
      urlAnnulation: `${urlPublique}/paiements/${id}/retour?annule=1`,
      urlNotification: `${urlPublique}/paiements/${fournisseur}/notification`,
      urlSimulation: `${urlPublique}/paiements/${id}/simulation?s=${secret}`,
    });
    db.prepare('UPDATE paiements SET reference_externe = ?, url = ?, secret = ? WHERE id = ?').run(
      res.referenceExterne,
      res.url,
      res.secret || secret,
      id,
    );
  } catch (e) {
    console.error(e);
    appliquerResultat(db, id, 'echoue');
    throw e;
  }
  return { ...lire(db, id), simulation: f.simulation };
}

// Met à jour le paiement et ses commandes. Ne fait rien si le paiement est déjà terminé.
export function appliquerResultat(db, paiementId, resultat) {
  if (resultat === 'en_attente') return false;
  const r = db
    .prepare("UPDATE paiements SET statut = ?, maj_le = datetime('now') WHERE id = ? AND statut = 'en_attente'")
    .run(resultat, paiementId);
  if (r.changes === 0) return false;
  const p = lire(db, paiementId);
  const commandes = db.prepare('SELECT * FROM commandes WHERE paiement_id = ?').all(paiementId);
  const ids = commandes.map((c) => `#${c.id}`).join(', ');

  if (resultat === 'reussi') {
    db.prepare(
      "UPDATE commandes SET statut = 'en_attente', statut_paiement = 'paye' WHERE paiement_id = ? AND statut = 'attente_paiement'",
    ).run(paiementId);
    notifier(db, [p.client_id], `Paiement ${NOMS[p.fournisseur]} reçu ✅ (${p.montant} FCFA). Recherche d'un livreur…`);
    for (const c of commandes) annoncerCommande(db, c, `(payée par ${NOMS[p.fournisseur]})`);
  } else {
    db.prepare("UPDATE commandes SET statut = 'annulee' WHERE paiement_id = ? AND statut = 'attente_paiement'").run(
      paiementId,
    );
    notifier(db, [p.client_id], `Paiement ${NOMS[p.fournisseur]} non abouti : commande ${ids} annulée.`);
  }
  return true;
}

// Redemande le statut au fournisseur (source de vérité).
export async function verifierPaiement(db, fournisseurs, paiementId) {
  const p = lire(db, paiementId);
  if (!p || p.statut !== 'en_attente') return p;
  try {
    const resultat = await fournisseurs[p.fournisseur].verifier(p);
    appliquerResultat(db, p.id, resultat);
  } catch (e) {
    console.error(`Vérification du paiement ${p.id} impossible :`, e.message);
  }
  const maj = lire(db, paiementId);
  // Trop ancien et toujours pas payé : on abandonne.
  const ageMin = (Date.now() - Date.parse(`${maj.cree_le.replace(' ', 'T')}Z`)) / 60000;
  if (maj.statut === 'en_attente' && ageMin > EXPIRATION_MIN) appliquerResultat(db, maj.id, 'echoue');
  return lire(db, paiementId);
}

// Vérification régulière des paiements en attente (au cas où une notification se perd).
export async function verifierPaiementsEnAttente(db, fournisseurs) {
  const enAttente = db
    .prepare("SELECT id FROM paiements WHERE statut = 'en_attente' AND cree_le < datetime('now', '-20 seconds')")
    .all();
  for (const { id } of enAttente) await verifierPaiement(db, fournisseurs, id);
}

const page = (titre, contenu) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f5f5f4;color:#1c1917;margin:0;padding:24px;text-align:center}
  .carte{background:#fff;border-radius:16px;padding:24px;max-width:420px;margin:40px auto;border:1px solid #e7e5e4}
  button{width:100%;padding:16px;border:0;border-radius:12px;font-size:17px;font-weight:700;color:#fff;margin-top:12px}
  .ok{background:#16a34a}.non{background:#fff;color:#dc2626;border:2px solid #dc2626}.montant{font-size:28px;font-weight:800;margin:12px 0}
</style></head><body><div class="carte">${contenu}</div></body></html>`;

const echapper = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Routes publiques appelées par le navigateur du téléphone ou par Orange / Wave.
export function routesPaiement({ db, fournisseurs }) {
  const r = express.Router();

  // Retour après paiement (success_url / return_url / cancel_url).
  r.get('/paiements/:id/retour', async (req, res) => {
    const id = Number(req.params.id);
    const p = await verifierPaiement(db, fournisseurs, id);
    if (!p) return res.status(404).send(page('Paiement', '<h2>Paiement introuvable</h2>'));
    const message = {
      reussi: '<h2>✅ Paiement confirmé</h2><p>Retournez dans l\'application pour suivre votre commande.</p>',
      echoue: '<h2>❌ Paiement non abouti</h2><p>Retournez dans l\'application pour choisir un autre moyen de paiement.</p>',
      en_attente: '<h2>⏳ Paiement en cours de confirmation</h2><p>Retournez dans l\'application : la confirmation s\'affichera automatiquement.</p>',
    }[p.statut];
    res.send(page('Paiement', message));
  });

  // Page de paiement simulé (uniquement sans clés API).
  r.get('/paiements/:id/simulation', (req, res) => {
    const p = lire(db, Number(req.params.id));
    if (!p || !fournisseurs[p.fournisseur].simulation || p.secret !== req.query.s) {
      return res.status(404).send(page('Paiement', '<h2>Paiement introuvable</h2>'));
    }
    if (p.statut !== 'en_attente') {
      return res.redirect(`/paiements/${p.id}/retour`);
    }
    const nom = NOMS[p.fournisseur];
    res.send(
      page(
        nom,
        `<img src="${LOGOS[p.fournisseur]}" alt="${nom}" width="96" height="96" style="border-radius:22px">
         <h2>${nom}</h2><p>🧪 Simulation — aucun argent n'est débité</p>
         <div class="montant">${p.montant.toLocaleString('fr-FR')} FCFA</div>
         <form method="post"><input type="hidden" name="s" value="${echapper(p.secret)}">
           <button class="ok" style="background:${COULEURS[p.fournisseur]}" name="resultat" value="reussi">Payer</button>
           <button class="non" name="resultat" value="echoue">Refuser</button>
         </form>`,
      ),
    );
  });

  r.post('/paiements/:id/simulation', express.urlencoded({ extended: false }), (req, res) => {
    const p = lire(db, Number(req.params.id));
    if (!p || !fournisseurs[p.fournisseur].simulation || p.secret !== req.body.s) {
      return res.status(404).send(page('Paiement', '<h2>Paiement introuvable</h2>'));
    }
    appliquerResultat(db, p.id, req.body.resultat === 'reussi' ? 'reussi' : 'echoue');
    res.redirect(303, `/paiements/${p.id}/retour`);
  });

  // Notifications serveur à serveur.
  r.post('/paiements/wave/notification', async (req, res) => {
    const wave = fournisseurs.wave;
    if (wave.simulation || !wave.signatureValide(req.get('wave-signature'), req.corpsBrut?.toString('utf8') ?? '')) {
      return res.status(401).json({ erreur: 'Signature invalide' });
    }
    const session = req.body?.data || {};
    const p = db
      .prepare("SELECT id FROM paiements WHERE fournisseur = 'wave' AND (reference_externe = ? OR reference = ?)")
      .get(session.id ?? '', session.client_reference ?? '');
    if (p) await verifierPaiement(db, fournisseurs, p.id);
    res.json({ ok: true });
  });

  r.post('/paiements/orange/notification', async (req, res) => {
    const orange = fournisseurs.orange;
    if (orange.simulation) return res.status(404).end();
    const p = db
      .prepare("SELECT * FROM paiements WHERE fournisseur = 'orange' AND secret = ?")
      .get(String(req.body?.notif_token ?? ''));
    if (!p || !orange.notificationValide(req.body, p)) return res.status(401).json({ erreur: 'Jeton invalide' });
    await verifierPaiement(db, fournisseurs, p.id);
    res.json({ ok: true });
  });

  return r;
}
