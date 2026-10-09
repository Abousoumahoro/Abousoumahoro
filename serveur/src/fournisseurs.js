import crypto from 'node:crypto';

// Connecteurs de paiement mobile. Chacun expose :
//   creer({ reference, montant, urlRetour, urlAnnulation, urlNotification, urlSimulation })
//     → { referenceExterne, url, secret? }
//   verifier(paiement) → 'reussi' | 'echoue' | 'en_attente'
// Le serveur ne fait jamais confiance au téléphone ni à la seule notification :
// le statut est toujours redemandé au fournisseur avec verifier().

const egaliteSure = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function lireJson(res, fournisseur) {
  const texte = await res.text();
  let corps = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    // réponse non JSON
  }
  if (!res.ok) {
    const detail = corps?.message || corps?.description || texte.slice(0, 200);
    throw new Error(`${fournisseur} : erreur ${res.status} ${detail}`);
  }
  return corps;
}

// ---------- Wave (API Checkout) ----------
export function creerWave({ cleApi, secretWebhook, urlApi = 'https://api.wave.com', fetch = globalThis.fetch }) {
  const entetes = { Authorization: `Bearer ${cleApi}`, 'Content-Type': 'application/json' };
  return {
    nom: 'wave',
    simulation: false,
    async creer({ reference, montant, urlRetour, urlAnnulation }) {
      const res = await fetch(`${urlApi}/v1/checkout/sessions`, {
        method: 'POST',
        headers: { ...entetes, 'Idempotency-Key': reference },
        body: JSON.stringify({
          amount: String(montant),
          currency: 'XOF',
          client_reference: reference,
          success_url: urlRetour,
          error_url: urlAnnulation,
        }),
      });
      const session = await lireJson(res, 'Wave');
      return { referenceExterne: session.id, url: session.wave_launch_url };
    },
    async verifier(paiement) {
      const res = await fetch(`${urlApi}/v1/checkout/sessions/${encodeURIComponent(paiement.reference_externe)}`, {
        headers: entetes,
      });
      const session = await lireJson(res, 'Wave');
      if (session.payment_status === 'succeeded') return 'reussi';
      if (session.checkout_status === 'expired' || session.payment_status === 'cancelled') return 'echoue';
      return 'en_attente';
    },
    // En-tête « Wave-Signature: t=<horodatage>,v1=<signature>[,v1=…] »
    // signature = HMAC-SHA256(secret, horodatage + corps brut).
    signatureValide(entete, corpsBrut, maintenant = Date.now()) {
      if (!secretWebhook || !entete) return false;
      const parties = entete.split(',').map((p) => p.trim().split('='));
      const t = parties.find(([k]) => k === 't')?.[1];
      const signatures = parties.filter(([k]) => k === 'v1').map(([, v]) => v);
      if (!t || Math.abs(maintenant / 1000 - Number(t)) > 300) return false;
      const attendue = crypto.createHmac('sha256', secretWebhook).update(t + corpsBrut).digest('hex');
      return signatures.some((s) => egaliteSure(s, attendue));
    },
  };
}

// ---------- Orange Money (API Web Payment) ----------
export function creerOrange({
  clientId,
  clientSecret,
  cleMarchand,
  urlApi = 'https://api.orange.com',
  chemin = '/orange-money-webpay/ci/v1',
  devise = 'XOF',
  fetch = globalThis.fetch,
}) {
  let jeton = null;
  let expireA = 0;

  async function jetonAcces() {
    if (jeton && Date.now() < expireA) return jeton;
    const res = await fetch(`${urlApi}/oauth/v3/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
    const corps = await lireJson(res, 'Orange Money');
    jeton = corps.access_token;
    expireA = Date.now() + (Number(corps.expires_in) || 3600) * 1000 - 60_000;
    return jeton;
  }

  async function appeler(route, donnees) {
    const res = await fetch(`${urlApi}${chemin}${route}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await jetonAcces()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(donnees),
    });
    return lireJson(res, 'Orange Money');
  }

  return {
    nom: 'orange',
    simulation: false,
    async creer({ reference, montant, urlRetour, urlAnnulation, urlNotification }) {
      const r = await appeler('/webpayment', {
        merchant_key: cleMarchand,
        currency: devise,
        order_id: reference,
        amount: montant,
        return_url: urlRetour,
        cancel_url: urlAnnulation,
        notif_url: urlNotification,
        lang: 'fr',
        reference: 'Livraison & Ventes',
      });
      // notif_token : renvoyé par Orange dans la notification, pour l'authentifier.
      return { referenceExterne: r.pay_token, url: r.payment_url, secret: r.notif_token };
    },
    async verifier(paiement) {
      const r = await appeler('/transactionstatus', {
        order_id: paiement.reference,
        amount: paiement.montant,
        pay_token: paiement.reference_externe,
      });
      if (r.status === 'SUCCESS') return 'reussi';
      if (r.status === 'FAILED' || r.status === 'EXPIRED') return 'echoue';
      return 'en_attente';
    },
    notificationValide(corps, paiement) {
      return Boolean(corps?.notif_token) && egaliteSure(corps.notif_token, paiement.secret);
    },
  };
}

// ---------- Simulation (aucune clé configurée) ----------
// Le téléphone ouvre une page du serveur avec les boutons « Payer » et « Refuser ».
export function creerSimulation(nom) {
  return {
    nom,
    simulation: true,
    async creer({ urlSimulation }) {
      return { referenceExterne: null, url: urlSimulation };
    },
    // Le statut est fixé directement par la page de simulation.
    async verifier(paiement) {
      return paiement.statut;
    },
  };
}

// Choisit le vrai connecteur si les clés sont présentes, sinon la simulation.
export function fournisseursDepuisEnv(env = process.env) {
  const wave = env.WAVE_API_KEY
    ? creerWave({ cleApi: env.WAVE_API_KEY, secretWebhook: env.WAVE_WEBHOOK_SECRET, urlApi: env.WAVE_API_URL })
    : creerSimulation('wave');
  const orange =
    env.ORANGE_CLIENT_ID && env.ORANGE_CLIENT_SECRET && env.ORANGE_MERCHANT_KEY
      ? creerOrange({
          clientId: env.ORANGE_CLIENT_ID,
          clientSecret: env.ORANGE_CLIENT_SECRET,
          cleMarchand: env.ORANGE_MERCHANT_KEY,
          urlApi: env.ORANGE_API_URL,
          chemin: env.ORANGE_WEBPAY_PATH,
          devise: env.ORANGE_CURRENCY,
        })
      : creerSimulation('orange');
  return { wave, orange };
}
