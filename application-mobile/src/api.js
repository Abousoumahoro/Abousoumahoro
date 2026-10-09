import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const CLE_ADRESSE = 'adresse_serveur';

// Adresse du serveur, par ordre de priorité :
// 1. celle saisie dans l'application (« ⚙️ Serveur » sur l'écran de connexion) ;
// 2. EXPO_PUBLIC_API_URL (ex : https://api.mondomaine.com), fixée à la fabrication ;
// 3. en développement avec Expo Go : l'ordinateur qui lance « npm start » (port 3000).
function adresseParDefaut() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const hote = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${hote || 'localhost'}:3000`;
}

let API_URL = adresseParDefaut();
export const adresseServeur = () => API_URL;

export async function chargerAdresseServeur() {
  try {
    const enregistree = await SecureStore.getItemAsync(CLE_ADRESSE);
    if (enregistree) API_URL = enregistree;
  } catch {
    // on garde l'adresse par défaut
  }
  return API_URL;
}

// Accepte « 192.168.1.20 », « 192.168.1.20:3000 » ou une adresse complète.
export function normaliserAdresse(saisie) {
  let a = saisie.trim().replace(/\/+$/, '');
  if (!a) return adresseParDefaut();
  if (!/^https?:\/\//.test(a)) a = `http://${a}`;
  if (/^http:\/\/[^/:]+$/.test(a)) a = `${a}:3000`;
  return a;
}

export async function changerAdresseServeur(saisie) {
  API_URL = normaliserAdresse(saisie);
  await SecureStore.setItemAsync(CLE_ADRESSE, API_URL).catch(() => {});
  return API_URL;
}

// Vérifie que le serveur répond (bouton « Tester »).
export async function testerServeur(adresse) {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), 5000);
  try {
    const res = await fetch(`${adresse}/sante`, { signal: controle.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

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
