# Livraison & Ventes — Application Mobile (Android + iPhone)

![Aperçu](../docs/apercu.png)

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

## Comptes

Chaque profil crée son compte (nom, téléphone, mot de passe, quartier ;
nom de boutique pour le commerçant, véhicule pour le livreur) puis se connecte.
La session reste enregistrée de façon sécurisée sur le téléphone (`expo-secure-store`).
Chacun ne voit que ses propres commandes et notifications.

## Paiement

- **Orange Money / Wave** : l'application ouvre Wave ou la page Orange Money, puis attend la
  confirmation du serveur (écran « Paiement en cours »). Tant qu'aucune clé marchand n'est
  configurée sur le serveur, une page de **simulation** s'ouvre (voir `../serveur/README.md`).
- **Paiement à la livraison** : le livreur voit le montant à encaisser.
- **Carte bancaire** : encore simulée.

## GPS du livreur

Interrupteur **« 📍 GPS réel »** en haut de l'espace livreur :
- **désactivé** (par défaut) : le trajet A → B est simulé — pratique pour une démo hors d'Abidjan ;
- **activé** : la position du téléphone est envoyée au serveur toutes les 10 s (ou tous les 20 m)
  pendant que l'application est ouverte. Le client et le commerçant voient le livreur bouger
  sur la carte, et le livreur confirme la remise avec « J'ai remis le colis ».
  Les colis proposés sont alors ceux à moins de 15 km de sa vraie position.

## Notifications sur le téléphone

Chaque nouvel événement (commande payée, colis accepté, livreur en route, colis livré…)
s'affiche en bannière avec un son, tant que l'application est ouverte ou en arrière-plan récent.

> Les notifications quand l'application est **complètement fermée** demandent une
> application compilée (EAS Build) et des notifications « push » envoyées par le serveur :
> c'est l'étape à faire avant la publication sur le Play Store / l'App Store.

> ⚠️ Encore simulée : la carte bancaire.

## Démarrer

1. Lancez d'abord le **serveur** (voir `../serveur/README.md`) :
   ```bash
   cd serveur && npm install && npm start
   ```
2. Puis l'application, dans un autre terminal :
   ```bash
   cd application-mobile
   npm install
   npm start
   ```
3. Scannez le QR code avec **Expo Go** (Play Store / App Store).
   Le téléphone et l'ordinateur doivent être sur le **même Wi-Fi** :
   l'application trouve le serveur automatiquement (port 3000 de l'ordinateur).

Pour utiliser un serveur en ligne : `EXPO_PUBLIC_API_URL=https://votre-serveur.com npm start`.

Comptes de démo (mot de passe `demo1234`) : client `0500000010`,
livreur `0100000020`, commerçants `0700000001` et `0700000002`.

## Structure

```
application-mobile/
├── App.js                         # Choix du profil (3 boutons) → connexion → espace
├── app.json                       # Nom, identifiants Android/iOS
└── src/
    ├── api.js                     # Appels au serveur
    ├── context/AuthContext.js     # Compte connecté, session sécurisée
    ├── hooks.js                   # Chargement + rafraîchissement automatique
    ├── constantes.js              # Catégories, paiements, statuts
    ├── components/                # Carte A→B, boutons, fiches contact…
    └── screens/
        ├── ChoixRole.js
        ├── Authentification.js    # Connexion / création de compte
        ├── SuiviCommande.js       # Suivi sur carte (client + commerçant)
        ├── client/EspaceClient.js
        ├── livreur/EspaceLivreur.js
        └── commercant/EspaceCommercant.js
```
