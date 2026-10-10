import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './context/AuthContext';

const dansExpoGo = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

// expo-notifications n'est plus pris en charge par Expo Go sur Android : on ne le charge
// que dans l'application compilée (APK / App Store) ou sur iPhone. Sinon, les notifications
// restent visibles dans l'onglet « Notifications » de l'application.
let Notifications = null;
if (Platform.OS !== 'web' && !(dansExpoGo && Platform.OS === 'android')) {
  try {
    Notifications = require('expo-notifications');
    // Afficher la bannière même quand l'application est au premier plan.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    Notifications = null;
  }
}

async function preparer() {
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('commandes', {
      name: 'Commandes et livraisons',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export const CLE_JETON_PUSH = 'jeton_push';

// Notifications « push » (même application fermée). Nécessite une application
// compilée avec EAS (projectId dans app.json) : dans Expo Go, on retourne null.
async function enregistrerPush(api) {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!Notifications || !projectId || dansExpoGo) return null;
  const { data: jeton } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api('/moi/push', { methode: 'POST', corps: { jeton } });
  await SecureStore.setItemAsync(CLE_JETON_PUSH, jeton);
  return jeton;
}

// Surveille les nouvelles notifications du serveur et les affiche sur le téléphone
// (bannière + son), tant que l'application est ouverte ou vient d'être mise en arrière-plan.
// Si les push sont actives, c'est le serveur qui envoie : pas besoin de surveiller.
export function useAlertesTelephone(intervalleMs = 8000) {
  const { api, utilisateur } = useAuth();
  const dernierId = useRef(null);

  useEffect(() => {
    if (!utilisateur) return undefined;
    dernierId.current = null;
    let autorise = false;
    let push = false;
    let actif = true;
    preparer()
      .then(async (ok) => {
        autorise = ok;
        if (ok) push = Boolean(await enregistrerPush(api).catch(() => null));
      })
      .catch(() => {});

    const verifier = async () => {
      try {
        const liste = await api('/notifications');
        if (!actif || liste.length === 0) return;
        const max = liste[0].id;
        // Premier chargement : on ne ré-affiche pas l'historique.
        if (dernierId.current !== null && autorise && !push) {
          const nouvelles = liste.filter((n) => n.id > dernierId.current).reverse();
          for (const n of nouvelles) {
            await Notifications.scheduleNotificationAsync({
              content: { title: 'Livraison & Ventes', body: n.message, sound: 'default' },
              trigger: Platform.OS === 'android' ? { channelId: 'commandes' } : null,
            });
          }
        }
        dernierId.current = Math.max(dernierId.current ?? 0, max);
      } catch {
        // réseau indisponible : nouvel essai au prochain tour
      }
    };

    verifier();
    const t = setInterval(verifier, intervalleMs);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, [api, utilisateur, intervalleMs]);
}
