import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './context/AuthContext';

// Afficher la bannière même quand l'application est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function preparer() {
  if (Platform.OS === 'web') return false;
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

// Surveille les nouvelles notifications du serveur et les affiche sur le téléphone
// (bannière + son), tant que l'application est ouverte ou vient d'être mise en arrière-plan.
export function useAlertesTelephone(intervalleMs = 8000) {
  const { api, utilisateur } = useAuth();
  const dernierId = useRef(null);

  useEffect(() => {
    if (!utilisateur) return undefined;
    dernierId.current = null;
    let autorise = false;
    let actif = true;
    preparer()
      .then((ok) => {
        autorise = ok;
      })
      .catch(() => {});

    const verifier = async () => {
      try {
        const liste = await api('/notifications');
        if (!actif || liste.length === 0) return;
        const max = liste[0].id;
        // Premier chargement : on ne ré-affiche pas l'historique.
        if (dernierId.current !== null && autorise) {
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
