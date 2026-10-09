import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { avancerLivraisons, creerApp } from '../src/app.js';
import { ouvrirBase, remplirDemo } from '../src/db.js';
import { creerSimulation } from '../src/fournisseurs.js';
import { creerJetons } from '../src/securite.js';

let serveur;
let base;
let db;
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'livraison-test-'));

before(async () => {
  db = ouvrirBase(':memory:');
  remplirDemo(db);
  const fournisseurs = { wave: creerSimulation('wave'), orange: creerSimulation('orange') };
  const app = creerApp({ db, jetons: creerJetons(dossier), fournisseurs });
  await new Promise((ok) => {
    serveur = app.listen(0, ok);
  });
  base = `http://127.0.0.1:${serveur.address().port}`;
});

after(() => {
  serveur.close();
  fs.rmSync(dossier, { recursive: true, force: true });
});

async function api(chemin, { jeton, ...options } = {}) {
  const res = await fetch(base + chemin, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
    },
    body: options.body && JSON.stringify(options.body),
  });
  const texte = await res.text();
  return { statut: res.status, corps: texte ? JSON.parse(texte) : null };
}

const connexion = async (telephone, motDePasse = 'demo1234') =>
  (await api('/auth/connexion', { method: 'POST', body: { telephone, motDePasse } })).corps.jeton;

test('inscription, connexion et profil', async () => {
  const r = await api('/auth/inscription', {
    method: 'POST',
    body: { role: 'client', nom: 'Fatou', telephone: '07 11 22 33 44', motDePasse: 'secret12', quartier: 'yopougon' },
  });
  assert.equal(r.statut, 201);
  assert.equal(r.corps.utilisateur.telephone, '0711223344');
  assert.ok(r.corps.jeton);

  const doublon = await api('/auth/inscription', {
    method: 'POST',
    body: { role: 'client', nom: 'Autre', telephone: '0711223344', motDePasse: 'secret12', quartier: 'yopougon' },
  });
  assert.equal(doublon.statut, 409);

  const mauvais = await api('/auth/connexion', { method: 'POST', body: { telephone: '0711223344', motDePasse: 'faux' } });
  assert.equal(mauvais.statut, 401);

  const jeton = await connexion('0711223344', 'secret12');
  const moi = await api('/moi', { jeton });
  assert.equal(moi.corps.nom, 'Fatou');
  assert.equal(moi.corps.mot_de_passe, undefined);
});

test('un commerçant doit donner le nom de sa boutique', async () => {
  const r = await api('/auth/inscription', {
    method: 'POST',
    body: { role: 'commercant', nom: 'X', telephone: '0799999999', motDePasse: 'secret12', quartier: 'plateau' },
  });
  assert.equal(r.statut, 400);
});

test('routes protégées et rôles', async () => {
  assert.equal((await api('/produits')).statut, 401);
  const client = await connexion('0500000010');
  const r = await api('/produits', { jeton: client, method: 'POST', body: { nom: 'X', prix: 10, categorie: 'repas' } });
  assert.equal(r.statut, 403);
});

test('parcours complet : publication, commande, vérification, livraison', async () => {
  const awa = await connexion('0700000001');
  const client = await connexion('0500000010');
  const livreur = await connexion('0100000020');

  const pub = await api('/produits', {
    jeton: awa,
    method: 'POST',
    body: { nom: 'Poulet braisé', prix: 3000, categorie: 'repas', description: 'Avec attiéké' },
  });
  assert.equal(pub.statut, 201);
  const repas = (await api('/produits?categorie=repas', { jeton: client })).corps;
  assert.ok(repas.some((p) => p.id === pub.corps.id && p.commercant === 'Chez Tantie Awa'));

  // Panier avec 2 commerçants → 2 commandes ; prix recalculés par le serveur.
  const riz = (await api('/produits?categorie=courses', { jeton: client })).corps.find((p) => p.nom.startsWith('Riz'));
  const cmd = await api('/commandes', {
    jeton: client,
    method: 'POST',
    body: {
      paiement: 'livraison',
      articles: [
        { produitId: pub.corps.id, quantite: 2, prix: 1 },
        { produitId: riz.id, quantite: 1 },
      ],
    },
  });
  assert.equal(cmd.statut, 201);
  assert.equal(cmd.corps.commandes.length, 2);
  assert.equal(cmd.corps.paiement, null);
  const commande = cmd.corps.commandes.find((c) => c.commercant.nom === 'Chez Tantie Awa');
  assert.equal(commande.total, 6000);
  assert.equal(commande.statutPaiement, 'en_attente');

  // Le commerçant voit sa commande, pas celle de la supérette.
  const deAwa = (await api('/commandes', { jeton: awa })).corps;
  assert.deepEqual(deAwa.map((c) => c.id), [commande.id]);

  const proches = (await api('/livreur/colis-proches', { jeton: livreur })).corps;
  assert.ok(proches.some((c) => c.id === commande.id));

  const acc = await api('/livreur/accepter', { jeton: livreur, method: 'POST', body: { ids: [commande.id] } });
  assert.deepEqual(acc.corps.acceptes, [commande.id]);

  // Partir sans vérifier l'intérieur est refusé.
  const refus = await api(`/commandes/${commande.id}/verification`, {
    jeton: livreur,
    method: 'POST',
    body: { articlesVerifies: [pub.corps.id], interieurOk: false },
  });
  assert.equal(refus.statut, 400);

  const ok = await api(`/commandes/${commande.id}/verification`, {
    jeton: livreur,
    method: 'POST',
    body: { articlesVerifies: [pub.corps.id], interieurOk: true },
  });
  assert.equal(ok.corps.statut, 'en_cours');

  avancerLivraisons(db, 0.5);
  const milieu = (await api(`/commandes/${commande.id}`, { jeton: client })).corps;
  assert.equal(milieu.progression, 0.5);
  assert.equal(milieu.livreur.nom, 'Moussa Koné');

  avancerLivraisons(db, 0.5);
  const fin = (await api(`/commandes/${commande.id}`, { jeton: client })).corps;
  assert.equal(fin.statut, 'livree');
  assert.equal(fin.statutPaiement, 'paye');

  const notifs = (await api('/notifications', { jeton: client })).corps;
  assert.ok(notifs.some((n) => n.message.includes(`#${commande.id} livré`)));
});

test('un client ne voit pas la commande d\'un autre client', async () => {
  const client = await connexion('0500000010');
  const [c] = (await api('/commandes', { jeton: client })).corps;
  const autre = (await api('/auth/inscription', {
    method: 'POST',
    body: { role: 'client', nom: 'Curieux', telephone: '0788888888', motDePasse: 'secret12', quartier: 'abobo' },
  })).corps.jeton;
  assert.equal((await api(`/commandes/${c.id}`, { jeton: autre })).statut, 404);
});

test('GPS réel du livreur : position et avancement', async () => {
  const client = await connexion('0500000010');
  const livreur = await connexion('0100000020');
  const riz = (await api('/produits?categorie=courses', { jeton: client })).corps.find((p) => p.nom.startsWith('Riz'));
  const [c] = (await api('/commandes', {
    jeton: client,
    method: 'POST',
    body: { paiement: 'livraison', articles: [{ produitId: riz.id, quantite: 1 }] },
  })).corps.commandes;
  await api('/livreur/accepter', { jeton: livreur, method: 'POST', body: { ids: [c.id] } });
  await api(`/commandes/${c.id}/verification`, {
    jeton: livreur,
    method: 'POST',
    body: { articlesVerifies: [riz.id], interieurOk: true },
  });
  // Milieu du trajet A → B.
  const milieu = {
    latitude: (c.depart.latitude + c.arrivee.latitude) / 2,
    longitude: (c.depart.longitude + c.arrivee.longitude) / 2,
  };
  const r = await api('/livreur/position', { jeton: livreur, method: 'POST', body: milieu });
  assert.equal(r.corps.commandesMisesAJour, 1);
  avancerLivraisons(db, 0.9); // la simulation ne touche plus une livraison suivie par GPS
  const suivi = (await api(`/commandes/${c.id}`, { jeton: client })).corps;
  assert.deepEqual(suivi.positionLivreur, milieu);
  assert.ok(Math.abs(suivi.progression - 0.5) < 0.05);
  assert.equal(suivi.statut, 'en_cours');
  const fin = await api(`/commandes/${c.id}/livree`, { jeton: livreur, method: 'POST' });
  assert.equal(fin.corps.statut, 'livree');
  assert.equal(fin.corps.statutPaiement, 'paye');
});
