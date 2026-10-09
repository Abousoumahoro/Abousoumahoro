# Application Mobile (Android + iPhone)

Projet [Expo](https://expo.dev) / React Native : un seul code pour Android et iOS.

## Démarrer

```bash
cd application-mobile
npm install
npx expo install --fix   # aligne les versions sur le SDK Expo
npm start
```

Ensuite :
- **Sur téléphone** : installez l'application **Expo Go** (Play Store / App Store) et scannez le QR code.
- **Android (émulateur)** : `npm run android`
- **iPhone (simulateur, Mac uniquement)** : `npm run ios`

## Structure

```
application-mobile/
├── App.js          # Écran principal
├── app.json        # Configuration (nom, identifiants Android/iOS)
├── assets/         # Images, icônes
├── babel.config.js
└── package.json
```
