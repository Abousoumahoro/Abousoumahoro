import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ErreurApi, requete } from '../api';
import { ROLES } from '../constantes';

const CLE_JETON = 'jeton_session';
const CLE_JETON_PUSH = 'jeton_push';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [jeton, setJeton] = useState(null);
  const [utilisateur, setUtilisateur] = useState(null);
  const [demarrage, setDemarrage] = useState(true);

  // Au lancement : reprendre la session enregistrée sur le téléphone.
  useEffect(() => {
    (async () => {
      try {
        const enregistre = await SecureStore.getItemAsync(CLE_JETON);
        if (enregistre) {
          const moi = await requete('/moi', { jeton: enregistre });
          setJeton(enregistre);
          setUtilisateur(moi);
        }
      } catch (e) {
        if (e.statut === 401) await SecureStore.deleteItemAsync(CLE_JETON);
      } finally {
        setDemarrage(false);
      }
    })();
  }, []);

  const ouvrirSession = async ({ jeton: j, utilisateur: u }) => {
    await SecureStore.setItemAsync(CLE_JETON, j);
    setJeton(j);
    setUtilisateur(u);
    return u;
  };

  // Refuse la connexion si le compte n'a pas le profil choisi sur l'écran d'accueil.
  const connexion = async (telephone, motDePasse, roleAttendu) => {
    const session = await requete('/auth/connexion', { methode: 'POST', corps: { telephone, motDePasse } });
    const role = session.utilisateur.role;
    if (roleAttendu && role !== roleAttendu) {
      throw new ErreurApi(
        `Ce numéro correspond à un compte ${ROLES[role].label}. Revenez en arrière et choisissez « ${ROLES[role].label} ».`,
        403,
      );
    }
    return ouvrirSession(session);
  };

  const inscription = async (donnees) =>
    ouvrirSession(await requete('/auth/inscription', { methode: 'POST', corps: donnees }));

  const deconnexion = useCallback(async () => {
    // Ce téléphone ne doit plus recevoir les notifications de ce compte.
    const jetonPush = await SecureStore.getItemAsync(CLE_JETON_PUSH).catch(() => null);
    if (jetonPush && jeton) {
      await requete('/moi/push/supprimer', { methode: 'POST', corps: { jeton: jetonPush }, jeton }).catch(() => {});
      await SecureStore.deleteItemAsync(CLE_JETON_PUSH).catch(() => {});
    }
    await SecureStore.deleteItemAsync(CLE_JETON);
    setJeton(null);
    setUtilisateur(null);
  }, [jeton]);

  // Requête authentifiée ; déconnecte automatiquement si la session a expiré.
  const api = useCallback(
    async (chemin, options = {}) => {
      try {
        return await requete(chemin, { ...options, jeton });
      } catch (e) {
        if (e.statut === 401) deconnexion();
        throw e;
      }
    },
    [jeton, deconnexion],
  );

  return (
    <AuthContext.Provider value={{ jeton, utilisateur, demarrage, connexion, inscription, deconnexion, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
