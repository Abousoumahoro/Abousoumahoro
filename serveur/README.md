# Serveur — Livraison & Ventes

API Node.js (Express) + base de données SQLite intégrée à Node (aucune installation de base de données).

## Démarrer

Prérequis : **Node.js 22.13 ou plus récent**.

```bash
cd serveur
npm install
npm start        # ou « npm run dev » pour redémarrer à chaque modification
npm test         # tests automatiques
```

Au premier démarrage, des comptes de démo sont créés (mot de passe `demo1234`) :

| Profil | Téléphone |
|---|---|
| Client | 0500000010 |
| Livreur | 0100000020 |
| Commerçant (Chez Tantie Awa) | 0700000001 |
| Commerçant (Supérette du Plateau) | 0700000002 |

Les données sont dans `donnees/livraison.db` (supprimez le dossier `donnees/` pour repartir de zéro).

## Mise en ligne (Docker + HTTPS)

`Dockerfile`, `docker-compose.yml` (avec Caddy pour le HTTPS automatique) et `.env.exemple`
sont prêts : voir **../GUIDE-MISE-EN-SERVICE.md**, étape 2.

En production (`NODE_ENV=production`) : pas de comptes de démo et **aucun paiement simulé**
(Wave / Orange Money sans clés et carte bancaire sont refusés). `DEMO=1` réactive la démo.

## Sécurité supplémentaire

- Après 8 mauvais mots de passe, le numéro est bloqué 15 minutes.
- Notifications push via Expo (route `POST /moi/push`) ; jetons supprimés à la déconnexion
  ou quand le téléphone n'existe plus.

## Configuration (variables d'environnement)

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute | 3000 |
| `JWT_SECRET` | Secret des sessions (**obligatoire en production**) | généré dans `donnees/.secret` |
| `DOSSIER_DONNEES` | Dossier de la base | `serveur/donnees` |
| `DUREE_TRAJET_S` | Durée simulée d'un trajet A → B | 60 |
| `URL_PUBLIQUE` | Adresse internet HTTPS du serveur (retours et notifications de paiement) | — |

## Paiement Orange Money et Wave

**Sans clés, le paiement est en mode simulation** : le téléphone ouvre une page du serveur
avec les boutons « Payer » / « Refuser ». Aucun argent n'est débité.

Déroulement :
1. Le client commande avec Orange Money ou Wave → la commande est **en attente du paiement**
   (invisible pour le commerçant et les livreurs).
2. L'application ouvre Wave ou la page Orange Money ; le client valide.
3. Orange / Wave préviennent le serveur ; **le serveur redemande toujours le statut au fournisseur**
   avant de valider (une notification ou un retour navigateur ne suffit pas).
4. Paiement confirmé → la commande est payée, le commerçant et les livreurs proches sont prévenus.
   Paiement refusé, annulé ou non confirmé après 30 min → commande annulée, le panier du client est conservé.

### Passer en paiement réel

1. Ouvrir un compte marchand :
   - **Wave Business** → clé API Checkout et secret de webhook (signature).
   - **Orange Money** (Orange Developer, API « Web Payment ») → Client ID, Client Secret et Merchant Key.
2. Héberger le serveur sur internet en **HTTPS** et définir `URL_PUBLIQUE`.
3. Déclarer l'adresse de notification :
   - Wave : `https://<URL_PUBLIQUE>/paiements/wave/notification`
   - Orange : envoyée automatiquement à chaque paiement (`notif_url`).
4. Définir les variables :

| Variable | Rôle |
|---|---|
| `WAVE_API_KEY` | Clé API Wave Checkout |
| `WAVE_WEBHOOK_SECRET` | Secret de signature des webhooks Wave |
| `WAVE_API_URL` | (facultatif) défaut `https://api.wave.com` |
| `ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET` | Identifiants de l'application Orange Developer |
| `ORANGE_MERCHANT_KEY` | Clé marchand Orange Money |
| `ORANGE_API_URL` | (facultatif) défaut `https://api.orange.com` |
| `ORANGE_WEBPAY_PATH` | (facultatif) défaut `/orange-money-webpay/ci/v1` (Côte d'Ivoire) |
| `ORANGE_CURRENCY` | (facultatif) défaut `XOF` — l'environnement de test Orange utilise souvent `OUV` |

Au démarrage, le serveur affiche pour chaque moyen « SIMULATION » ou « RÉEL ».

> ⚠️ Les adresses et formats des API Orange et Wave ont été écrits d'après leur documentation
> publique et testés avec un faux serveur, **pas encore avec de vraies clés**. Faites un premier
> paiement de test (environnement sandbox) et vérifiez les valeurs ci-dessus avec la
> documentation fournie lors de votre inscription marchand.

La carte bancaire reste simulée (considérée payée immédiatement).

## Sécurité

- Mots de passe hachés (scrypt + sel), jamais stockés en clair.
- Sessions par jeton JWT (30 jours).
- Chaque route vérifie le profil : seul un commerçant publie, seul un client commande,
  seul un livreur prend des colis ; chacun ne voit que ses commandes.
- Les prix sont recalculés par le serveur (le téléphone ne peut pas les modifier).
- En production : servir en **HTTPS** et définir `JWT_SECRET`.

## Routes principales

| Méthode | Route | Qui |
|---|---|---|
| POST | `/auth/inscription`, `/auth/connexion` | tous |
| GET | `/moi`, `/notifications`, `/commandes`, `/commandes/:id` | connecté |
| GET | `/produits?categorie=` | connecté |
| GET/POST/DELETE | `/mes-produits`, `/produits`, `/produits/:id` | commerçant |
| POST | `/commandes` | client |
| GET/POST | `/paiements/:id`, `/paiements/:id/verifier`, `/paiements/:id/annuler` | client |
| POST | `/paiements/wave/notification`, `/paiements/orange/notification` | Wave / Orange |
| GET | `/livreur/colis-proches` | livreur |
| POST | `/livreur/accepter`, `/commandes/:id/verification`, `/commandes/:id/livree`, `/livreur/position` | livreur |
