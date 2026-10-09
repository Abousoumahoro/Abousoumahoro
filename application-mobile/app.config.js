// Complète app.json avec les réglages propres à votre compte (variables d'environnement) :
//   EAS_PROJECT_ID       (facultatif) identifiant du projet Expo, si vous ne le mettez pas dans app.json
//   GOOGLE_MAPS_API_KEY  clé Google Maps pour les cartes Android dans l'application compilée
//   AUTORISER_HTTP=1     APK de test : autorise un serveur en http:// (ordinateur sur le Wi-Fi)
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ['expo-build-properties', { android: { usesCleartextTraffic: process.env.AUTORISER_HTTP === '1' } }],
  ],
  android: {
    ...config.android,
    ...(process.env.GOOGLE_MAPS_API_KEY && {
      config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } },
    }),
  },
  extra: {
    ...config.extra,
    carteGoogle: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    ...(process.env.EAS_PROJECT_ID && { eas: { projectId: process.env.EAS_PROJECT_ID } }),
  },
});
