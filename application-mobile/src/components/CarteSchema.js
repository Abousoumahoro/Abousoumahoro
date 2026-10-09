import { StyleSheet, Text, View } from 'react-native';

// Carte simplifiée (schéma du trajet A → B), utilisée quand la vraie carte n'est pas
// disponible : APK Android sans clé Google Maps, ou version web.
export default function CarteSchema({ commande, hauteur = 280 }) {
  const { depart, arrivee, positionLivreur } = commande;
  const points = [depart, arrivee, positionLivreur].filter(Boolean);
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLa, maxLa, minLo, maxLo] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  // Position en % dans le cadre (marge de 12 %).
  const versCadre = (p) => ({
    x: 12 + ((p.longitude - minLo) / (maxLo - minLo || 1)) * 76,
    y: 12 + ((maxLa - p.latitude) / (maxLa - minLa || 1)) * 76,
  });
  const a = versCadre(depart);
  const b = versCadre(arrivee);
  const pointilles = Array.from({ length: 13 }, (_, i) => {
    const t = (i + 1) / 14;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
  const place = ({ x, y }) => ({ left: `${x}%`, top: `${y}%` });

  return (
    <View style={[styles.carte, { height: hauteur }]}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={`h${i}`} style={[styles.rue, { top: `${i * 14}%`, left: 0, right: 0, height: 5 }]} />
      ))}
      {[1, 2, 3, 4].map((i) => (
        <View key={`v${i}`} style={[styles.rue, { left: `${i * 20}%`, top: 0, bottom: 0, width: 5 }]} />
      ))}
      {pointilles.map((p, i) => (
        <View key={i} style={[styles.point, place(p)]} />
      ))}
      <Text style={[styles.repere, place(a)]}>🅰️</Text>
      <Text style={[styles.repere, place(b)]}>🅱️</Text>
      {positionLivreur && <Text style={[styles.repere, styles.livreur, place(versCadre(positionLivreur))]}>🛵</Text>}
      <Text style={styles.legende}>Schéma du trajet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 14, overflow: 'hidden', marginBottom: 12, backgroundColor: '#eef0e8' },
  rue: { position: 'absolute', backgroundColor: '#fff' },
  point: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  repere: { position: 'absolute', fontSize: 22, transform: [{ translateX: -12 }, { translateY: -14 }] },
  livreur: { fontSize: 26 },
  legende: { position: 'absolute', right: 8, bottom: 6, fontSize: 11, color: '#78716c' },
});
