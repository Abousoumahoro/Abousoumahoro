export const CATEGORIES = [
  { id: 'repas', label: 'Repas', icone: '🍲' },
  { id: 'courses', label: 'Courses', icone: '🛒' },
  { id: 'divers', label: 'Produits divers', icone: '📦' },
];

export const MOYENS_PAIEMENT = [
  { id: 'carte', label: 'Carte bancaire', icone: '💳' },
  { id: 'orange', label: 'Orange Money', icone: '🟠', logo: require('../assets/paiement/orange-money.png'), couleur: '#ff7900' },
  { id: 'wave', label: 'Wave', icone: '🌊', logo: require('../assets/paiement/wave.png'), couleur: '#1dc8ff' },
  { id: 'livraison', label: 'Paiement à la livraison', icone: '💵' },
];

export const STATUTS = {
  attente_paiement: { label: 'En attente du paiement', couleur: '#78716c' },
  en_attente: { label: 'En attente d\'un livreur', couleur: '#f59e0b' },
  verification: { label: 'Livreur : vérification du colis', couleur: '#8b5cf6' },
  en_cours: { label: 'En cours de livraison', couleur: '#3b82f6' },
  livree: { label: 'Livrée', couleur: '#16a34a' },
  annulee: { label: 'Annulée', couleur: '#dc2626' },
};

export const ROLES = {
  client: { label: 'Client', icone: '🛍️' },
  livreur: { label: 'Livreur', icone: '🛵' },
  commercant: { label: 'Commerçant', icone: '🏪' },
};
