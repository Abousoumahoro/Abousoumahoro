# Guide de mise en service — Livraison & Ventes

Ce guide explique, étape par étape, comment passer de la démo à une application
publiée sur le **Play Store** et l'**App Store**, avec de vrais paiements.

---

## Étape 0 — Tester chez vous (gratuit, 10 minutes)

> **Sur Windows, le plus simple :** installez Node.js, puis **double-cliquez sur
> `LANCER-WINDOWS.bat`** (à la racine du projet) et acceptez la demande d'autorisation.
> Il ouvre le pare-feu, démarre le serveur et l'application. Il ne reste qu'à scanner
> le QR code avec Expo Go.

Il faut un ordinateur avec **Node.js 22.13 ou plus récent** (https://nodejs.org).

```bash
# Terminal 1 : le serveur
cd serveur
npm install
npm start

# Terminal 2 : l'application
cd application-mobile
npm install
npm start
```

Installez **Expo Go** sur votre téléphone (Play Store / App Store) et scannez le QR code.
Le téléphone et l'ordinateur doivent être sur le **même Wi-Fi**.

Comptes de démo (mot de passe `demo1234`) :

| Profil | Téléphone |
|---|---|
| Client | 0500000010 |
| Livreur | 0100000020 |
| Commerçant | 0700000001 |

En démo, les paiements Wave / Orange Money ouvrent une **page de simulation** (Payer / Refuser).

---

## Étape 0 bis — Obtenir un APK Android de test (gratuit)

Pour installer l'application directement sur un téléphone Android, sans Expo Go :

1. Créez un compte gratuit sur **expo.dev**.
2. Sur l'ordinateur :
   ```bash
   npm install -g eas-cli
   cd application-mobile
   eas login
   eas init
   eas build -p android --profile preview
   ```
3. Au bout d'environ 15 minutes, EAS affiche un **lien et un QR code** : ouvrez-le sur le
   téléphone pour télécharger l'APK, puis installez-le (autorisez « sources inconnues »).
4. Lancez le serveur sur l'ordinateur (`cd serveur && npm start`) : il affiche son adresse,
   par exemple `http://192.168.1.20:3000`.
5. Dans l'application, sur l'écran de connexion, touchez **« ⚙️ Serveur »**, tapez cette
   adresse (ou seulement `192.168.1.20`), puis **« Tester et enregistrer »**.
   Le téléphone et l'ordinateur doivent être sur le même Wi-Fi.

> Dans cet APK de test, la carte est un **schéma du trajet** (A → B, livreur 🛵) tant qu'aucune
> clé Google Maps n'est configurée (voir étape 4). Avec Expo Go ou sur iPhone, la vraie carte s'affiche.

---

## Étape 1 — Les comptes à ouvrir

| Compte | Pour quoi faire | Coût indicatif |
|---|---|---|
| **Expo** (expo.dev) | Fabriquer l'application et envoyer les notifications push | Gratuit pour commencer |
| **Google Play Console** | Publier sur Android | 25 $ une seule fois |
| **Apple Developer** | Publier sur iPhone | 99 $ par an |
| **Wave Business** | Encaisser par Wave (clé API Checkout) | Commission Wave |
| **Orange Money marchand** (Orange Developer, API « Web Payment ») | Encaisser par Orange Money | Commission Orange |
| **Hébergeur (VPS)** + **nom de domaine** | Mettre le serveur en ligne | ~5 à 10 € / mois |
| **Google Cloud** (clé Google Maps) | Afficher la carte sur Android | Gratuit dans la limite du quota |

> 💡 Orange Money demande un contrat marchand : comptez de quelques jours à plusieurs semaines.
> Lancez cette démarche en premier. En attendant, l'application fonctionne avec
> le **paiement à la livraison**.

---

## Étape 2 — Mettre le serveur en ligne

Sur un VPS (Ubuntu, avec Docker installé) :

1. Faites pointer votre domaine (ex : `api.livraison-ventes.ci`) vers l'adresse IP du VPS.
2. Copiez le dossier `serveur/` sur le VPS.
3. Préparez la configuration :
   ```bash
   cd serveur
   cp .env.exemple .env
   nano .env        # remplissez DOMAINE, JWT_SECRET (openssl rand -hex 32) et les clés de paiement
   ```
4. Lancez :
   ```bash
   docker compose up -d
   ```
   Caddy obtient automatiquement le certificat **HTTPS**.
5. Vérifiez : `https://api.votre-domaine.com/sante` doit afficher `{"ok":true}`.

Ce que fait le serveur en production (`NODE_ENV=production`, déjà réglé dans Docker) :
- **pas de comptes de démo** ;
- **aucune simulation de paiement** : sans clés, Wave / Orange Money sont refusés
  avec un message clair, et la carte bancaire aussi (pas encore branchée) ;
- les données sont gardées dans un volume Docker (`donnees`) : pensez à le sauvegarder.

---

## Étape 3 — Brancher les vrais paiements

Dans `serveur/.env` :

```
WAVE_API_KEY=...
WAVE_WEBHOOK_SECRET=...
ORANGE_CLIENT_ID=...
ORANGE_CLIENT_SECRET=...
ORANGE_MERCHANT_KEY=...
```

Dans le tableau de bord Wave Business, déclarez l'adresse de notification :
`https://api.votre-domaine.com/paiements/wave/notification`

Redémarrez (`docker compose up -d`) : les journaux (`docker compose logs api`) doivent
afficher « Paiement wave : RÉEL » et « Paiement orange : RÉEL ».

> ⚠️ **Faites d'abord un petit paiement de test** (100 FCFA) avec chaque moyen.
> Les connecteurs ont été écrits d'après les documentations publiques et testés avec
> un faux serveur, pas encore avec de vraies clés. En cas d'écart avec la documentation
> reçue lors de votre inscription marchand, les réglages `WAVE_API_URL`, `ORANGE_API_URL`,
> `ORANGE_WEBPAY_PATH` et `ORANGE_CURRENCY` permettent d'ajuster sans toucher au code.

---

## Étape 4 — Fabriquer l'application

Sur votre ordinateur :

```bash
npm install -g eas-cli
cd application-mobile
eas login                 # votre compte Expo
eas init                  # crée le projet et son identifiant (projectId)
```

Puis :
1. Si `eas init` vous demande d'ajouter l'identifiant vous-même, mettez-le dans
   `app.json`, dans la partie `"expo"` :
   ```json
   "extra": { "eas": { "projectId": "<identifiant affiché par eas init>" } }
   ```
   Cet identifiant active les **notifications push** (même application fermée).
2. Dans `eas.json`, remplacez `https://api.votre-domaine.com` par l'adresse de votre serveur.
3. Sur expo.dev → votre projet → **Environment variables**, ajoutez `GOOGLE_MAPS_API_KEY`
   (votre clé Google Maps, nécessaire pour la carte sur Android).
4. Fabriquez une version de test Android (fichier APK à installer directement) :
   ```bash
   eas build -p android --profile preview
   ```
   Installez l'APK sur quelques téléphones et testez avec de vrais comptes.
5. Quand tout est bon, la version pour les stores :
   ```bash
   eas build -p android --profile production
   eas build -p ios --profile production
   eas submit -p android
   eas submit -p ios
   ```

---

## Étape 5 — Avant d'ouvrir au public

- [ ] Paiement de test réussi avec Wave **et** Orange Money
- [ ] Une livraison complète testée avec le GPS réel (interrupteur « GPS réel » du livreur)
- [ ] Notifications reçues application fermée
- [ ] Sauvegarde régulière du volume `donnees` du serveur
- [ ] **Politique de confidentialité** publiée sur une page web (obligatoire pour le Play Store
      et l'App Store : l'application utilise le téléphone, la position et les paiements)
- [ ] Conditions générales (frais de livraison, remboursements, responsabilité en cas de colis abîmé)
- [ ] Captures d'écran et description pour les stores (un aperçu est dans `docs/apercu.png`)

---

## Ce qui reste à faire plus tard

- **Carte bancaire** : à brancher sur un prestataire (ex : CinetPay, PayDunya) — aujourd'hui
  refusée en production.
- **Mot de passe oublié** : réinitialisation par SMS (nécessite un fournisseur de SMS).
- **Adresse de livraison précise** : aujourd'hui, le point B est le centre du quartier choisi
  à l'inscription (plus l'adresse écrite). Étape suivante : choisir le point exact sur la carte.
- **Commission / reversement** aux commerçants et livreurs.
