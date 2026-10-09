import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { creerApp } from '../src/app.js';
import { ouvrirBase, remplirDemo } from '../src/db.js';
import { creerSimulation } from '../src/fournisseurs.js';
import { configurerEnvoiPush } from '../src/push.js';
import { creerJetons } from '../src/securite.js';

const envois = [];
let serveur;
let base;
let db;
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'push-test-'));

before(async () => {
  configurerEnvoiPush(async (messages) => {
    envois.push(...messages);
    return messages.map((m) =>
      m.to.includes('perime') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' },
    );
  });
  db = ouvrirBase(':memory:');
  remplirDemo(db);
  const app = creerApp({
    db,
    jetons: creerJetons(dossier),
    fournisseurs: { wave: creerSimulation('wave'), orange: creerSimulation('orange') },
  });
  serveur = await new Promise((ok) => {
    const s = app.listen(0, () => ok(s));
  });
  base = `http://127.0.0.1:${serveur.address().port}`;
});

after(() => {
  configurerEnvoiPush(null);
  serveur.close();
  fs.rmSync(dossier, { recursive: true, force: true });
});

const api = async (chemin, { jeton, corps } = {}) => {
  const res = await fetch(base + chemin, {
    method: corps ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(jeton && { Authorization: `Bearer ${jeton}` }) },
    body: corps && JSON.stringify(corps),
  });
  return { statut: res.status, corps: await res.json().catch(() => null) };
};
const connexion = async (telephone, motDePasse = 'demo1234') =>
  api('/auth/connexion', { corps: { telephone, motDePasse } });
const attendre = () => new Promise((ok) => setTimeout(ok, 50));

test('push : le commerçant reçoit la nouvelle commande sur son téléphone', async () => {
  const client = (await connexion('0500000010')).corps.jeton;
  const awa = (await connexion('0700000001')).corps.jeton;
  assert.equal((await api('/moi/push', { jeton: awa, corps: { jeton: 'pas-un-jeton' } })).statut, 400);
  assert.equal((await api('/moi/push', { jeton: awa, corps: { jeton: 'ExponentPushToken[awa-1]' } })).statut, 200);
  await api('/moi/push', { jeton: awa, corps: { jeton: 'ExponentPushToken[perime]' } });

  const garba = (await api('/produits?categorie=repas', { jeton: client })).corps.find((p) => p.nom === 'Garba');
  await api('/commandes', {
    jeton: client,
    corps: { paiement: 'livraison', articles: [{ produitId: garba.id, quantite: 1 }] },
  });
  await attendre();
  const pourAwa = envois.filter((m) => m.to === 'ExponentPushToken[awa-1]');
  assert.equal(pourAwa.length, 1);
  assert.match(pourAwa[0].body, /Nouvelle commande #\d+/);
  // Le jeton refusé par Expo est supprimé.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push_jetons WHERE jeton LIKE '%perime%'").get().n, 0);

  // Déconnexion : le téléphone ne reçoit plus rien.
  await api('/moi/push/supprimer', { jeton: awa, corps: { jeton: 'ExponentPushToken[awa-1]' } });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_jetons').get().n, 0);
});

test('connexion bloquée après trop de mauvais mots de passe', async () => {
  for (let i = 0; i < 8; i++) assert.equal((await connexion('0100000020', 'mauvais')).statut, 401);
  const bloque = await connexion('0100000020', 'demo1234');
  assert.equal(bloque.statut, 429);
  assert.match(bloque.corps.erreur, /Trop de tentatives/);
  // Les autres comptes ne sont pas touchés.
  assert.equal((await connexion('0500000010')).statut, 200);
});
