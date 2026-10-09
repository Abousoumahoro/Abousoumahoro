import Constants from 'expo-constants';

// Adresse du serveur :
// 1. EXPO_PUBLIC_API_URL si définie (ex : https://api.mondomaine.com) ;
// 2. sinon, en développement, l'ordinateur qui lance « npm start » (port 3000).
function adresseServeur() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const hote = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${hote || 'localhost'}:3000`;
}

export const API_URL = adresseServeur();

export class ErreurApi extends Error {
  constructor(message, statut) {
    super(message);
    this.statut = statut;
  }
}

export async function requete(chemin, { methode = 'GET', corps, jeton } = {}) {
  let res;
  try {
    res = await fetch(API_URL + chemin, {
      method: methode,
      headers: {
        'Content-Type': 'application/json',
        ...(jeton && { Authorization: `Bearer ${jeton}` }),
      },
      body: corps && JSON.stringify(corps),
    });
  } catch {
    throw new ErreurApi(`Serveur injoignable (${API_URL}). Vérifiez qu'il est démarré.`, 0);
  }
  const texte = await res.text();
  let donnees = null;
  try {
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    throw new ErreurApi(`Réponse inattendue du serveur (${res.status})`, res.status);
  }
  if (!res.ok) throw new ErreurApi(donnees?.erreur || `Erreur ${res.status}`, res.status);
  return donnees;
}
