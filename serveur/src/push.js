// Notifications « push » : arrivent sur le téléphone même quand l'application est fermée.
// Envoi via le service gratuit d'Expo (https://docs.expo.dev/push-notifications/sending-notifications/).

const URL_EXPO = 'https://exp.host/--/api/v2/push/send';

export const jetonPushValide = (j) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(String(j || ''));

async function envoyerViaExpo(messages) {
  const reponses = [];
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch(URL_EXPO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    const corps = await res.json();
    reponses.push(...(corps.data || []));
  }
  return reponses;
}

// Remplaçable (tests, ou PUSH_DESACTIVE=1).
let envoyer = process.env.PUSH_DESACTIVE ? null : envoyerViaExpo;
export function configurerEnvoiPush(fn) {
  envoyer = fn;
}

export function envoyerPush(db, utilisateurIds, message) {
  if (!envoyer || utilisateurIds.length === 0) return Promise.resolve();
  const marques = utilisateurIds.map(() => '?').join(', ');
  const jetons = db
    .prepare(`SELECT jeton FROM push_jetons WHERE utilisateur_id IN (${marques})`)
    .all(...utilisateurIds)
    .map((l) => l.jeton);
  if (jetons.length === 0) return Promise.resolve();
  const messages = jetons.map((to) => ({
    to,
    title: 'Livraison & Ventes',
    body: message,
    sound: 'default',
    channelId: 'commandes',
  }));
  return envoyer(messages)
    .then((reponses) => {
      // Téléphone désinstallé ou jeton expiré : on l'oublie.
      reponses.forEach((r, i) => {
        if (r?.details?.error === 'DeviceNotRegistered') {
          db.prepare('DELETE FROM push_jetons WHERE jeton = ?').run(messages[i].to);
        }
      });
    })
    .catch((e) => console.error('Envoi push impossible :', e.message));
}
