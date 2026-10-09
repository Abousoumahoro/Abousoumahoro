# Livraison & Ventes — Application Mobile (Android + iPhone)

Projet [Expo](https://expo.dev) SDK 57 / React Native : un seul code pour Android et iOS.

## Les 3 espaces

À l'ouverture, 3 boutons : **Client**, **Livreur**, **Commerçant**.

### 🛍️ Client
- Boutique par catégorie : **Repas**, **Courses**, **Produits divers**
- Panier et paiement : **Carte bancaire**, **Orange Money**, **Wave** ou **Paiement à la livraison**
- Suivi du colis sur la carte du **point A** (commerçant) au **point B** (client)
- Coordonnées du livreur (appeler, SMS, WhatsApp)
- Notifications et historique des commandes

### 🛵 Livreur
- Liste des colis disponibles **à proximité**, triés par distance
- Sélection d'**un ou plusieurs colis**
- **Vérification obligatoire de l'intérieur du colis** (chaque article à cocher) avant de pouvoir partir
- Déplacement sur la carte entre A et B, montant à encaisser si paiement à la livraison

### 🏪 Commerçant
- **Publication d'articles** (nom, prix, description, catégorie)
- Commandes reçues, suivi du colis sur la carte, coordonnées du livreur
- Notifications et total des ventes

> ⚠️ Version de démonstration : les données sont fictives (`src/data/mock.js`),
> le paiement et le déplacement du livreur sont **simulés**. Étapes suivantes :
> serveur + base de données, comptes utilisateurs, vrai GPS (`expo-location`),
> notifications push (`expo-notifications`), API Orange Money / Wave / carte.

## Démarrer

```bash
cd application-mobile
npm install
npm start
```

Puis scannez le QR code avec l'application **Expo Go** (Play Store / App Store).

## Structure

```
application-mobile/
├── App.js                         # Choix du rôle (3 boutons)
├── app.json                       # Nom, identifiants Android/iOS
└── src/
    ├── context/AppContext.js      # Commandes, panier, notifications, simulation du trajet
    ├── data/mock.js               # Données de démo (Abidjan)
    ├── components/                # Carte A→B, boutons, fiche livreur…
    └── screens/
        ├── ChoixRole.js
        ├── SuiviCommande.js       # Suivi sur carte (client + commerçant)
        ├── client/EspaceClient.js
        ├── livreur/EspaceLivreur.js
        └── commercant/EspaceCommercant.js
```
