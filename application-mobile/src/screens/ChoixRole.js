import { Pressable, StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../theme';

const ROLES = [
  { id: 'client', label: 'Client', icone: '🛍️', detail: 'Commander des repas, courses et produits', couleur: couleurs.client },
  { id: 'livreur', label: 'Livreur', icone: '🛵', detail: 'Prendre et livrer des colis', couleur: couleurs.livreur },
  { id: 'commercant', label: 'Commerçant', icone: '🏪', detail: 'Publier mes articles et suivre mes ventes', couleur: couleurs.commercant },
];

export default function ChoixRole({ onChoisir }) {
  return (
    <View style={styles.conteneur}>
      <Text style={styles.logo}>📦</Text>
      <Text style={styles.titre}>Livraison & Ventes</Text>
      <Text style={styles.sousTitre}>Qui êtes-vous ?</Text>
      {ROLES.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => onChoisir(r.id)}
          style={({ pressed }) => [styles.bouton, { backgroundColor: r.couleur, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.icone}>{r.icone}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.boutonTitre}>{r.label}</Text>
            <Text style={styles.boutonDetail}>{r.detail}</Text>
          </View>
          <Text style={styles.fleche}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: couleurs.fond },
  logo: { fontSize: 56, textAlign: 'center' },
  titre: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: couleurs.texte },
  sousTitre: { fontSize: 17, textAlign: 'center', color: couleurs.texteDoux, marginBottom: 28, marginTop: 4 },
  bouton: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 14 },
  icone: { fontSize: 34, marginRight: 14 },
  boutonTitre: { color: '#fff', fontSize: 20, fontWeight: '800' },
  boutonDetail: { color: '#fff', opacity: 0.9, marginTop: 2 },
  fleche: { color: '#fff', fontSize: 30, fontWeight: '300' },
});
