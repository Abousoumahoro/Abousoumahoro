import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';

// Charge une ressource du serveur et la rafraîchit toutes les `intervalleMs`
// (suivi en direct des commandes, colis et notifications).
export function useDonnees(chemin, intervalleMs = 0) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);

  const recharger = useCallback(async () => {
    try {
      setDonnees(await api(chemin));
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    }
  }, [api, chemin]);

  useEffect(() => {
    recharger();
    if (!intervalleMs) return undefined;
    const t = setInterval(recharger, intervalleMs);
    return () => clearInterval(t);
  }, [recharger, intervalleMs]);

  return { donnees, erreur, recharger, chargement: donnees === null && !erreur };
}
