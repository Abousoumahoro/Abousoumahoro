import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../theme';

export function Bouton({ titre, onPress, couleur = couleurs.primaire, desactive, contour, style }) {
  return (
    <Pressable
      onPress={desactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.bouton,
        contour
          ? { borderWidth: 2, borderColor: couleur, backgroundColor: 'transparent' }
          : { backgroundColor: couleur },
        (pressed || desactive) && { opacity: desactive ? 0.4 : 0.8 },
        style,
      ]}
    >
      <Text style={[styles.boutonTexte, contour && { color: couleur }]}>{titre}</Text>
    </Pressable>
  );
}

export function Carte({ children, style }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

export function Badge({ texte, couleur }) {
  return (
    <View style={[styles.badge, { backgroundColor: couleur }]}>
      <Text style={styles.badgeTexte}>{texte}</Text>
    </View>
  );
}

export function EnTete({ titre, couleur, onRetour, droite }) {
  return (
    <View style={[styles.entete, { backgroundColor: couleur }]}>
      {onRetour ? (
        <Pressable onPress={onRetour} hitSlop={12}>
          <Text style={styles.enteteRetour}>‹ Retour</Text>
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
      <Text style={styles.enteteTitre} numberOfLines={1}>
        {titre}
      </Text>
      <View style={{ minWidth: 60, alignItems: 'flex-end' }}>{droite}</View>
    </View>
  );
}

// Barre d'onglets en bas de l'écran.
export function Onglets({ onglets, actif, onChange, couleur }) {
  return (
    <View style={styles.onglets}>
      {onglets.map((o) => (
        <Pressable key={o.id} style={styles.onglet} onPress={() => onChange(o.id)}>
          <Text style={{ fontSize: 20 }}>{o.icone}</Text>
          <Text
            style={[
              styles.ongletTexte,
              { color: actif === o.id ? couleur : couleurs.texteDoux },
              actif === o.id && { fontWeight: '700' },
            ]}
          >
            {o.label}
            {o.compteur ? ` (${o.compteur})` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Vide({ texte }) {
  return <Text style={styles.vide}>{texte}</Text>;
}

const styles = StyleSheet.create({
  bouton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  boutonTexte: { color: '#fff', fontWeight: '700', fontSize: 16 },
  carte: {
    backgroundColor: couleurs.carte,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeTexte: { color: '#fff', fontSize: 12, fontWeight: '700' },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  enteteTitre: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  enteteRetour: { color: '#fff', fontSize: 16, width: 60 },
  onglets: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    backgroundColor: '#fff',
    paddingVertical: 6,
  },
  onglet: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  ongletTexte: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  vide: { textAlign: 'center', color: couleurs.texteDoux, marginTop: 40, fontSize: 15 },
});

// Affiche un indicateur de chargement ou un message d'erreur (avec « Réessayer »).
export function EtatChargement({ chargement, erreur, onReessayer }) {
  if (chargement) return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  if (!erreur) return null;
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <Text style={{ color: couleurs.danger, textAlign: 'center', marginBottom: 12 }}>{erreur}</Text>
      {onReessayer && <Bouton titre="Réessayer" contour couleur={couleurs.danger} onPress={onReessayer} />}
    </View>
  );
}

export function BoutonDeconnexion({ onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Text style={{ color: '#fff', fontSize: 14 }}>Déconnexion</Text>
    </Pressable>
  );
}
