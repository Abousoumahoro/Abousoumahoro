import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';

const CLE_GPS = 'gps_livreur_actif';

// Choix « GPS réel » du livreur, mémorisé sur le téléphone.
export function useChoixGps() {
  const [actif, setActif] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(CLE_GPS)
      .then((v) => setActif(v === 'oui'))
      .catch(() => {});
  }, []);
  const changer = (valeur) => {
    setActif(valeur);
    SecureStore.setItemAsync(CLE_GPS, valeur ? 'oui' : 'non').catch(() => {});
  };
  return [actif, changer];
}

// Envoie la position réelle du livreur au serveur (toutes les 10 s ou tous les 20 m),
// tant que l'application est ouverte. Retourne un message d'état à afficher.
export function useSuiviGps(actif) {
  const { api } = useAuth();
  const [etat, setEtat] = useState(null);

  useEffect(() => {
    if (!actif) {
      setEtat(null);
      return undefined;
    }
    let abonnement = null;
    let annule = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEtat('Autorisez la localisation dans les réglages du téléphone.');
        return;
      }
      setEtat('Recherche de votre position…');
      abonnement = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 },
        async ({ coords }) => {
          try {
            await api('/livreur/position', {
              methode: 'POST',
              corps: { latitude: coords.latitude, longitude: coords.longitude },
            });
            setEtat(`Position envoyée à ${new Date().toLocaleTimeString('fr-FR').slice(0, 5)}`);
          } catch (e) {
            setEtat(e.message);
          }
        },
      );
      if (annule) abonnement.remove();
    })().catch((e) => setEtat(`GPS indisponible : ${e.message}`));

    return () => {
      annule = true;
      abonnement?.remove();
    };
  }, [actif, api]);

  return etat;
}
