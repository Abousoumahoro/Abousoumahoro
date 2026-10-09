// Données de démonstration (à remplacer plus tard par un vrai serveur / API).
// Coordonnées autour d'Abidjan.

export const CATEGORIES = [
  { id: 'repas', label: 'Repas', icone: '🍲' },
  { id: 'courses', label: 'Courses', icone: '🛒' },
  { id: 'divers', label: 'Produits divers', icone: '📦' },
];

export const MOYENS_PAIEMENT = [
  { id: 'carte', label: 'Carte bancaire', icone: '💳' },
  { id: 'orange', label: 'Orange Money', icone: '🟠' },
  { id: 'wave', label: 'Wave', icone: '🌊' },
  { id: 'livraison', label: 'Paiement à la livraison', icone: '💵' },
];

export const COMMERCANTS = [
  {
    id: 'm1',
    nom: 'Chez Tantie Awa',
    telephone: '+225 07 00 00 00 01',
    adresse: 'Cocody, Angré',
    position: { latitude: 5.3967, longitude: -3.9878 },
  },
  {
    id: 'm2',
    nom: 'Supérette du Plateau',
    telephone: '+225 07 00 00 00 02',
    adresse: 'Plateau, Av. Chardy',
    position: { latitude: 5.3236, longitude: -4.0197 },
  },
];

// Le commerçant connecté dans cette démo.
export const COMMERCANT_CONNECTE = 'm1';

export const PRODUITS_INITIAUX = [
  { id: 'p1', commercantId: 'm1', nom: 'Garba', prix: 1000, categorie: 'repas', description: 'Attiéké + thon frit' },
  { id: 'p2', commercantId: 'm1', nom: 'Alloco poulet', prix: 2500, categorie: 'repas', description: 'Banane plantain frite et poulet braisé' },
  { id: 'p3', commercantId: 'm1', nom: 'Jus de bissap (1L)', prix: 800, categorie: 'repas', description: 'Fait maison' },
  { id: 'p4', commercantId: 'm2', nom: 'Riz parfumé 5 kg', prix: 4500, categorie: 'courses', description: 'Sac de 5 kg' },
  { id: 'p5', commercantId: 'm2', nom: 'Huile 1L', prix: 1500, categorie: 'courses', description: 'Huile végétale' },
  { id: 'p6', commercantId: 'm2', nom: 'Chargeur USB-C', prix: 3000, categorie: 'divers', description: 'Charge rapide 20W' },
];

export const CLIENT = {
  nom: 'Client démo',
  telephone: '+225 05 00 00 00 10',
  adresse: 'Marcory, Zone 4',
  position: { latitude: 5.2986, longitude: -3.9822 },
};

export const LIVREUR = {
  id: 'l1',
  nom: 'Moussa Koné',
  telephone: '+225 01 00 00 00 20',
  vehicule: 'Moto — AB 1234 CI',
  position: { latitude: 5.3450, longitude: -4.0010 },
};

// Commandes déjà passées (historique + colis disponibles pour les livreurs).
export const COMMANDES_INITIALES = [
  {
    id: 'c100',
    commercantId: 'm2',
    articles: [{ produitId: 'p4', nom: 'Riz parfumé 5 kg', prix: 4500, quantite: 1 }],
    total: 4500,
    fraisLivraison: 1000,
    paiement: 'wave',
    statut: 'livree',
    livreurId: 'l1',
    depart: COMMERCANTS[1].position,
    arrivee: CLIENT.position,
    adresseLivraison: CLIENT.adresse,
    progression: 1,
    date: '2026-10-05T12:30:00',
  },
  {
    id: 'c101',
    commercantId: 'm1',
    articles: [{ produitId: 'p2', nom: 'Alloco poulet', prix: 2500, quantite: 2 }],
    total: 5000,
    fraisLivraison: 1000,
    paiement: 'livraison',
    statut: 'en_attente',
    livreurId: null,
    depart: COMMERCANTS[0].position,
    arrivee: { latitude: 5.3600, longitude: -3.9700 },
    adresseLivraison: 'Riviera 2',
    progression: 0,
    date: '2026-10-09T09:10:00',
  },
  {
    id: 'c102',
    commercantId: 'm2',
    articles: [
      { produitId: 'p5', nom: 'Huile 1L', prix: 1500, quantite: 2 },
      { produitId: 'p6', nom: 'Chargeur USB-C', prix: 3000, quantite: 1 },
    ],
    total: 6000,
    fraisLivraison: 1000,
    paiement: 'orange',
    statut: 'en_attente',
    livreurId: null,
    depart: COMMERCANTS[1].position,
    arrivee: { latitude: 5.3100, longitude: -4.0350 },
    adresseLivraison: 'Treichville, Av. 16',
    progression: 0,
    date: '2026-10-09T09:25:00',
  },
];

export const STATUTS = {
  en_attente: { label: 'En attente d\'un livreur', couleur: '#f59e0b' },
  verification: { label: 'Livreur : vérification du colis', couleur: '#8b5cf6' },
  en_cours: { label: 'En cours de livraison', couleur: '#3b82f6' },
  livree: { label: 'Livrée', couleur: '#16a34a' },
};
