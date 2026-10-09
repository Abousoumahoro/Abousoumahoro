import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { creerApp } from '../src/app.js';
import { ouvrirBase, remplirDemo } from '../src/db.js';
import { creerOrange, creerSimulation, creerWave } from '../src/fournisseurs.js';
import { creerJetons } from '../src/securite.js';

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'paiement-test-'));
const serveurs = [];
after(() => {
  serveurs.forEach((s) => s.close());
  fs.rmSync(dossier, { recursive: true, force: true });
});

async function demarrer(fournisseurs) {
  const db = ouvrirBase(':memory:');
  remplirDemo(db);
  const app = creerApp({ db, jetons: creerJetons(dossier), fournisseurs });
  const serveur = await new Promise((ok) => {
    const s = app.listen(0, () => ok(s));
  });
  serveurs.push(serveur);
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const api = async (chemin, { jeton, corps, methode = 'GET', form } = {}) => {
    const res = await fetch(base + chemin, {
      method: methode,
      redirect: 'manual',
      headers: {
        'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
        ...(jeton && { Authorization: `Bearer ${jeton}` }),
      },
      body: form ? new URLSearchParams(form).toString() : corps && JSON.stringify(corps),
    });
    const texte = await res.text();
    let json = null;
    try {
      json = JSON.parse(texte);
    } catch {
      // page HTML
    }
    return { statut: res.status, corps: json, texte };
  };
  const connexion = async (telephone) =>
    (await api('/auth/connexion', { methode: 'POST', corps: { telephone, motDePasse: 'demo1234' } })).corps.jeton;
  return { db, api, base, connexion };
}

const simulation = () => ({ wave: creerSimulation('wave'), orange: creerSimulation('orange') });

test('Wave (simulation) : la commande attend le paiement puis devient visible', async () => {
  const { api, connexion } = await demarrer(simulation());
  const client = await connexion('0500000010');
  const livreur = await connexion('0100000020');
  const awa = await connexion('0700000001');
  const [garba] = (await api('/produits?categorie=repas', { jeton: client })).corps.filter((p) => p.nom === 'Garba');

  const r = await api('/commandes', {
    jeton: client,
    methode: 'POST',
    corps: { paiement: 'wave', articles: [{ produitId: garba.id, quantite: 3 }] },
  });
  assert.equal(r.statut, 201);
  const { paiement, commandes } = r.corps;
  assert.equal(paiement.statut, 'en_attente');
  assert.equal(paiement.montant, 4000); // 3 × 1000 + livraison
  assert.equal(paiement.simulation, true);
  assert.equal(commandes[0].statut, 'attente_paiement');

  // Pas encore payée : invisible pour les livreurs et le commerçant.
  const avant = (await api('/livreur/colis-proches', { jeton: livreur })).corps;
  assert.ok(!avant.some((c) => c.id === commandes[0].id));
  assert.ok(!(await api('/commandes', { jeton: awa })).corps.some((c) => c.id === commandes[0].id));

  // Page de paiement : refusée sans le bon secret.
  const cheminPage = new URL(paiement.url).pathname;
  assert.equal((await api(`${cheminPage}?s=faux`)).statut, 404);
  const pageOk = await api(new URL(paiement.url).pathname + new URL(paiement.url).search);
  assert.equal(pageOk.statut, 200);
  assert.match(pageOk.texte, /4\s000 FCFA/);

  const secret = new URL(paiement.url).searchParams.get('s');
  const pay = await api(cheminPage, { methode: 'POST', form: { s: secret, resultat: 'reussi' } });
  assert.equal(pay.statut, 303);

  assert.equal((await api(`/paiements/${paiement.id}`, { jeton: client })).corps.statut, 'reussi');
  const cmd = (await api(`/commandes/${commandes[0].id}`, { jeton: client })).corps;
  assert.equal(cmd.statut, 'en_attente');
  assert.equal(cmd.statutPaiement, 'paye');
  const apres = (await api('/livreur/colis-proches', { jeton: livreur })).corps;
  assert.ok(apres.some((c) => c.id === commandes[0].id));
  assert.ok((await api('/commandes', { jeton: awa })).corps.some((c) => c.id === commandes[0].id));

  // Un deuxième « payer » ne change rien (pas de double traitement).
  await api(cheminPage, { methode: 'POST', form: { s: secret, resultat: 'echoue' } });
  assert.equal((await api(`/paiements/${paiement.id}`, { jeton: client })).corps.statut, 'reussi');
});

test('Orange Money (simulation) : refus ou abandon → commande annulée', async () => {
  const { api, connexion } = await demarrer(simulation());
  const client = await connexion('0500000010');
  const riz = (await api('/produits?categorie=courses', { jeton: client })).corps.find((p) => p.nom.startsWith('Riz'));
  const commander = () =>
    api('/commandes', {
      jeton: client,
      methode: 'POST',
      corps: { paiement: 'orange', articles: [{ produitId: riz.id, quantite: 1 }] },
    });

  const a = (await commander()).corps;
  const url = new URL(a.paiement.url);
  await api(url.pathname, { methode: 'POST', form: { s: url.searchParams.get('s'), resultat: 'echoue' } });
  assert.equal((await api(`/commandes/${a.commandes[0].id}`, { jeton: client })).corps.statut, 'annulee');

  const b = (await commander()).corps;
  const annule = await api(`/paiements/${b.paiement.id}/annuler`, { jeton: client, methode: 'POST' });
  assert.equal(annule.corps.statut, 'echoue');
  assert.equal((await api(`/commandes/${b.commandes[0].id}`, { jeton: client })).corps.statut, 'annulee');

  // Un autre client ne peut pas voir ce paiement.
  const autre = (await api('/auth/inscription', {
    methode: 'POST',
    corps: { role: 'client', nom: 'Autre', telephone: '0766666666', motDePasse: 'secret12', quartier: 'abobo' },
  })).corps.jeton;
  assert.equal((await api(`/paiements/${b.paiement.id}`, { jeton: autre })).statut, 404);
});

// Faux serveur Orange / Wave pour tester les connecteurs sans vraies clés.
function fauxFetch(routes) {
  const appels = [];
  const f = async (url, options = {}) => {
    appels.push({ url, ...options });
    const cle = Object.keys(routes).find((k) => url.includes(k));
    const [statut, corps] = routes[cle](options);
    return new Response(JSON.stringify(corps), { status: statut });
  };
  f.appels = appels;
  return f;
}

test('connecteur Wave : création, vérification et signature', async () => {
  let statut = 'processing';
  const fetch = fauxFetch({
    '/v1/checkout/sessions/cos_1': () => [200, { id: 'cos_1', checkout_status: 'open', payment_status: statut }],
    '/v1/checkout/sessions': (o) => {
      const corps = JSON.parse(o.body);
      assert.equal(corps.currency, 'XOF');
      assert.equal(corps.amount, '2500');
      assert.equal(o.headers.Authorization, 'Bearer cle');
      return [200, { id: 'cos_1', wave_launch_url: 'https://pay.wave.com/c/cos_1' }];
    },
  });
  const wave = creerWave({ cleApi: 'cle', secretWebhook: 'secret', fetch });
  const r = await wave.creer({ reference: 'LV-1', montant: 2500, urlRetour: 'https://x/ok', urlAnnulation: 'https://x/ko' });
  assert.deepEqual(r, { referenceExterne: 'cos_1', url: 'https://pay.wave.com/c/cos_1' });
  assert.equal(await wave.verifier({ reference_externe: 'cos_1' }), 'en_attente');
  statut = 'succeeded';
  assert.equal(await wave.verifier({ reference_externe: 'cos_1' }), 'reussi');

  const corps = '{"type":"checkout.session.completed"}';
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'secret').update(t + corps).digest('hex');
  assert.equal(wave.signatureValide(`t=${t},v1=${sig}`, corps), true);
  assert.equal(wave.signatureValide(`t=${t},v1=${sig}`, `${corps} `), false);
  assert.equal(wave.signatureValide(`t=${t - 3600},v1=${sig}`, corps), false);
});

test('connecteur Orange Money : notification puis confirmation auprès d\'Orange', async () => {
  let statut = 'PENDING';
  const fetch = fauxFetch({
    '/oauth/v3/token': () => [200, { access_token: 'tok', expires_in: 3600 }],
    '/webpayment': (o) => {
      const corps = JSON.parse(o.body);
      assert.equal(corps.merchant_key, 'marchand');
      assert.equal(corps.amount, 5500);
      assert.ok(corps.notif_url.endsWith('/paiements/orange/notification'));
      return [201, { pay_token: 'pt_1', payment_url: 'https://webpayment.orange/pt_1', notif_token: 'nt_secret' }];
    },
    '/transactionstatus': () => [201, { status: statut }],
  });
  const orange = creerOrange({ clientId: 'id', clientSecret: 'sec', cleMarchand: 'marchand', fetch });
  const { api, connexion } = await demarrer({ wave: creerSimulation('wave'), orange });
  const client = await connexion('0500000010');
  const riz = (await api('/produits?categorie=courses', { jeton: client })).corps.find((p) => p.nom.startsWith('Riz'));
  const { paiement, commandes } = (await api('/commandes', {
    jeton: client,
    methode: 'POST',
    corps: { paiement: 'orange', articles: [{ produitId: riz.id, quantite: 1 }] },
  })).corps;
  assert.equal(paiement.url, 'https://webpayment.orange/pt_1');

  // Jeton de notification faux → refusé.
  const faux = await api('/paiements/orange/notification', { methode: 'POST', corps: { status: 'SUCCESS', notif_token: 'x' } });
  assert.equal(faux.statut, 401);

  // Notification valide mais Orange dit encore « PENDING » → toujours en attente.
  await api('/paiements/orange/notification', { methode: 'POST', corps: { status: 'SUCCESS', notif_token: 'nt_secret' } });
  assert.equal((await api(`/paiements/${paiement.id}`, { jeton: client })).corps.statut, 'en_attente');

  statut = 'SUCCESS';
  const v = await api(`/paiements/${paiement.id}/verifier`, { jeton: client, methode: 'POST' });
  assert.equal(v.corps.statut, 'reussi');
  assert.equal((await api(`/commandes/${commandes[0].id}`, { jeton: client })).corps.statutPaiement, 'paye');
  // Le jeton OAuth est réutilisé.
  assert.equal(fetch.appels.filter((a) => a.url.includes('/oauth/')).length, 1);
});

test('migration d\'une base créée avant le paiement mobile', () => {
  const fichier = path.join(dossier, 'ancienne.db');
  const ancienne = new DatabaseSync(fichier);
  ancienne.exec(`
    CREATE TABLE utilisateurs (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, nom TEXT NOT NULL,
      telephone TEXT NOT NULL UNIQUE, mot_de_passe TEXT NOT NULL, nom_boutique TEXT, vehicule TEXT,
      quartier TEXT NOT NULL, adresse TEXT, latitude REAL NOT NULL, longitude REAL NOT NULL,
      cree_le TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE commandes (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, commercant_id INTEGER NOT NULL,
      livreur_id INTEGER, statut TEXT NOT NULL DEFAULT 'en_attente'
        CHECK (statut IN ('en_attente', 'verification', 'en_cours', 'livree')),
      paiement TEXT NOT NULL, statut_paiement TEXT NOT NULL DEFAULT 'en_attente', total INTEGER NOT NULL,
      frais_livraison INTEGER NOT NULL, adresse_livraison TEXT NOT NULL, depart_lat REAL NOT NULL, depart_lng REAL NOT NULL,
      arrivee_lat REAL NOT NULL, arrivee_lng REAL NOT NULL, progression REAL NOT NULL DEFAULT 0, livreur_lat REAL,
      livreur_lng REAL, gps_reel INTEGER NOT NULL DEFAULT 0, cree_le TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE lignes_commande (id INTEGER PRIMARY KEY AUTOINCREMENT,
      commande_id INTEGER NOT NULL REFERENCES commandes(id), produit_id INTEGER NOT NULL, nom TEXT NOT NULL,
      prix INTEGER NOT NULL, quantite INTEGER NOT NULL);
    INSERT INTO commandes (client_id, commercant_id, paiement, total, frais_livraison, adresse_livraison,
      depart_lat, depart_lng, arrivee_lat, arrivee_lng) VALUES (1, 2, 'livraison', 3000, 1000, 'Abobo', 5, -4, 5.1, -4.1);
  `);
  ancienne.close();

  const db = ouvrirBase(fichier);
  const c = db.prepare('SELECT * FROM commandes').get();
  assert.equal(c.total, 3000);
  assert.equal(c.paiement_id, null);
  db.prepare("UPDATE commandes SET statut = 'annulee' WHERE id = ?").run(c.id);
  const fk = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'lignes_commande'").get().sql;
  assert.match(fk, /REFERENCES commandes\(id\)/);
  db.close();
});
