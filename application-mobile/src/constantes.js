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

export const STATUTS = {
  en_attente: { label: 'En attente d\'un livreur', couleur: '#f59e0b' },
  verification: { label: 'Livreur : vérification du colis', couleur: '#8b5cf6' },
  en_cours: { label: 'En cours de livraison', couleur: '#3b82f6' },
  livree: { label: 'Livrée', couleur: '#16a34a' },
};

export const ROLES = {
  client: { label: 'Client', icone: '🛍️' },
  livreur: { label: 'Livreur', icone: '🛵' },
  commercant: { label: 'Commerçant', icone: '🏪' },
};
