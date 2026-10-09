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

## Configuration (variables d'environnement)

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute | 3000 |
| `JWT_SECRET` | Secret des sessions (**obligatoire en production**) | généré dans `donnees/.secret` |
| `DOSSIER_DONNEES` | Dossier de la base | `serveur/donnees` |
| `DUREE_TRAJET_S` | Durée simulée d'un trajet A → B | 60 |

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
| GET | `/livreur/colis-proches` | livreur |
| POST | `/livreur/accepter`, `/commandes/:id/verification`, `/commandes/:id/livree`, `/livreur/position` | livreur |
