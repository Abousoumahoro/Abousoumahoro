// Quartiers d'Abidjan avec leurs coordonnées GPS approximatives.
// Sert d'adresse de départ / d'arrivée tant que le GPS réel n'est pas branché.
export const QUARTIERS = [
  { id: 'plateau', nom: 'Plateau', latitude: 5.3236, longitude: -4.0197 },
  { id: 'cocody-angre', nom: 'Cocody — Angré', latitude: 5.3967, longitude: -3.9878 },
  { id: 'cocody-riviera2', nom: 'Cocody — Riviera 2', latitude: 5.36, longitude: -3.97 },
  { id: 'marcory-zone4', nom: 'Marcory — Zone 4', latitude: 5.2986, longitude: -3.9822 },
  { id: 'treichville', nom: 'Treichville', latitude: 5.31, longitude: -4.035 },
  { id: 'adjame', nom: 'Adjamé', latitude: 5.3506, longitude: -4.0233 },
  { id: 'yopougon', nom: 'Yopougon', latitude: 5.3364, longitude: -4.0889 },
  { id: 'abobo', nom: 'Abobo', latitude: 5.4164, longitude: -4.0203 },
  { id: 'koumassi', nom: 'Koumassi', latitude: 5.2917, longitude: -3.9492 },
  { id: 'port-bouet', nom: 'Port-Bouët', latitude: 5.255, longitude: -3.9264 },
];

export const quartierParId = (id) => QUARTIERS.find((q) => q.id === id);
