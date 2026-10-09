import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  CLIENT,
  COMMANDES_INITIALES,
  COMMERCANTS,
  LIVREUR,
  PRODUITS_INITIAUX,
} from '../data/mock';

const AppContext = createContext(null);

const FRAIS_LIVRAISON = 1000;
// Durée simulée d'un trajet A → B (en secondes) pour la démo.
const DUREE_TRAJET_S = 40;

let compteur = 200;
const nouvelId = (prefixe) => `${prefixe}${compteur++}`;

export function AppProvider({ children }) {
  const [produits, setProduits] = useState(PRODUITS_INITIAUX);
  const [commandes, setCommandes] = useState(COMMANDES_INITIALES);
  const [panier, setPanier] = useState([]); // [{ produit, quantite }]
  const [notifications, setNotifications] = useState([]);
  const commandesRef = useRef(commandes);
  commandesRef.current = commandes;

  const notifier = (destinataires, message) => {
    const date = new Date().toISOString();
    setNotifications((n) => [
      ...destinataires.map((d) => ({ id: nouvelId('n'), destinataire: d, message, date })),
      ...n,
    ]);
  };

  // --- Panier (client) ---
  const ajouterAuPanier = (produit) =>
    setPanier((p) => {
      const ligne = p.find((l) => l.produit.id === produit.id);
      if (ligne) {
        return p.map((l) => (l === ligne ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [...p, { produit, quantite: 1 }];
    });

  const retirerDuPanier = (produitId) =>
    setPanier((p) =>
      p
        .map((l) => (l.produit.id === produitId ? { ...l, quantite: l.quantite - 1 } : l))
        .filter((l) => l.quantite > 0),
    );

  // Une commande par commerçant (chaque commerçant = un point de départ A).
  const passerCommande = (paiement) => {
    const parCommercant = {};
    panier.forEach((l) => {
      (parCommercant[l.produit.commercantId] ||= []).push(l);
    });
    const nouvelles = Object.entries(parCommercant).map(([commercantId, lignes]) => {
      const commercant = COMMERCANTS.find((m) => m.id === commercantId);
      return {
        id: nouvelId('c'),
        commercantId,
        articles: lignes.map((l) => ({
          produitId: l.produit.id,
          nom: l.produit.nom,
          prix: l.produit.prix,
          quantite: l.quantite,
        })),
        total: lignes.reduce((s, l) => s + l.produit.prix * l.quantite, 0),
        fraisLivraison: FRAIS_LIVRAISON,
        paiement,
        statut: 'en_attente',
        livreurId: null,
        depart: commercant.position,
        arrivee: CLIENT.position,
        adresseLivraison: CLIENT.adresse,
        progression: 0,
        date: new Date().toISOString(),
      };
    });
    setCommandes((c) => [...nouvelles, ...c]);
    setPanier([]);
    nouvelles.forEach((c) => {
      notifier(['client'], `Commande ${c.id} enregistrée. Recherche d'un livreur…`);
      notifier(['commercant'], `Nouvelle commande ${c.id} (${c.articles.length} article(s)).`);
      notifier(['livreur'], `Nouveau colis disponible : ${c.id}.`);
    });
    return nouvelles;
  };

  // --- Livreur ---
  const accepterColis = (ids) => {
    setCommandes((c) =>
      c.map((cmd) =>
        ids.includes(cmd.id) && cmd.statut === 'en_attente'
          ? { ...cmd, statut: 'verification', livreurId: LIVREUR.id, verifie: false }
          : cmd,
      ),
    );
    ids.forEach((id) =>
      notifier(['client', 'commercant'], `${LIVREUR.nom} a accepté le colis ${id}.`),
    );
  };

  // Le livreur doit avoir vérifié l'intérieur du colis avant de partir.
  const confirmerVerificationEtPartir = (id) => {
    setCommandes((c) =>
      c.map((cmd) => (cmd.id === id ? { ...cmd, verifie: true, statut: 'en_cours' } : cmd)),
    );
    notifier(['client', 'commercant'], `Colis ${id} vérifié. Le livreur est en route !`);
  };

  // --- Commerçant ---
  const publierProduit = (produit) => {
    setProduits((p) => [{ ...produit, id: nouvelId('p') }, ...p]);
  };

  // Simulation du déplacement du livreur de A vers B.
  useEffect(() => {
    const timer = setInterval(() => {
      const enCours = commandesRef.current.filter((c) => c.statut === 'en_cours');
      if (enCours.length === 0) return;
      setCommandes((c) =>
        c.map((cmd) => {
          if (cmd.statut !== 'en_cours') return cmd;
          const progression = Math.min(1, cmd.progression + 1 / DUREE_TRAJET_S);
          if (progression >= 1) {
            return { ...cmd, progression: 1, statut: 'livree' };
          }
          return { ...cmd, progression };
        }),
      );
      enCours
        .filter((c) => c.progression + 1 / DUREE_TRAJET_S >= 1)
        .forEach((c) => notifier(['client', 'commercant', 'livreur'], `Colis ${c.id} livré ✅`));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const valeur = {
    produits,
    commandes,
    panier,
    notifications,
    ajouterAuPanier,
    retirerDuPanier,
    passerCommande,
    accepterColis,
    confirmerVerificationEtPartir,
    publierProduit,
  };

  return <AppContext.Provider value={valeur}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
