import { Component } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

// Si un écran plante, on affiche le message au lieu de fermer l'application
// (pratique pour envoyer une photo de l'erreur).
export default class GardeErreur extends Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error(erreur, info?.componentStack);
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;
    return (
      <ScrollView contentContainerStyle={styles.conteneur}>
        <Text style={styles.titre}>😕 Un problème est survenu</Text>
        <Text style={styles.texte}>Prenez une photo de cet écran et envoyez-la pour qu'on corrige.</Text>
        <Text style={styles.detail} selectable>
          {String(erreur?.message || erreur)}
          {'\n\n'}
          {String(erreur?.stack || '').split('\n').slice(0, 8).join('\n')}
        </Text>
        <Pressable style={styles.bouton} onPress={() => this.setState({ erreur: null })}>
          <Text style={styles.boutonTexte}>Réessayer</Text>
        </Pressable>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  conteneur: { padding: 24, paddingTop: 60 },
  titre: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  texte: { fontSize: 15, marginBottom: 16 },
  detail: { fontSize: 13, color: '#dc2626', backgroundColor: '#fef2f2', padding: 12, borderRadius: 8 },
  bouton: { marginTop: 20, backgroundColor: '#ea580c', padding: 14, borderRadius: 12, alignItems: 'center' },
  boutonTexte: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
