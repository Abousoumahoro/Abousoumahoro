import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MOYENS_PAIEMENT, STATUTS } from '../constantes';
import { useDonnees } from '../hooks';
import { couleurs } from '../theme';
import { formatDate, formatPrix } from '../utils';
import { Badge, Bouton, Carte, EtatChargement, Vide } from './ui';

export function ListeNotifications() {
  const { donnees, erreur, chargement, recharger } = useDonnees('/notifications', 5000);
  if (chargement || (erreur && !donnees)) {
    return <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />;
  }
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={donnees}
      keyExtractor={(n) => String(n.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
      ListEmptyComponent={<Vide texte="Aucune notification pour le moment." />}
      renderItem={({ item }) => (
        <Carte>
          <Text style={{ fontSize: 15 }}>🔔 {item.message}</Text>
          <Text style={styles.doux}>{formatDate(item.date)}</Text>
        </Carte>
      )}
    />
  );
}

// Coordonnées d'une personne (livreur, client…), avec boutons appeler / SMS / WhatsApp.
export function FicheContact({ titre, nom, telephone, detail }) {
  const tel = telephone.replace(/[^\d+]/g, '');
  return (
    <Carte>
      <Text style={styles.titre}>{titre}</Text>
      <Text style={{ fontSize: 16, fontWeight: '600' }}>{nom}</Text>
      {detail ? <Text style={styles.doux}>{detail}</Text> : null}
      <Text style={styles.doux}>{telephone}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Bouton titre="📞 Appeler" style={{ flex: 1 }} couleur={couleurs.livreur} onPress={() => Linking.openURL(`tel:${tel}`)} />
        <Bouton titre="💬 SMS" style={{ flex: 1 }} couleur={couleurs.client} onPress={() => Linking.openURL(`sms:${tel}`)} />
        <Bouton
          titre="WhatsApp"
          style={{ flex: 1 }}
          couleur="#25d366"
          onPress={() => Linking.openURL(`https://wa.me/${tel.replace('+', '')}`)}
        />
      </View>
    </Carte>
  );
}

export function ResumeCommande({ commande, onPress }) {
  const statut = STATUTS[commande.statut];
  const paiement = MOYENS_PAIEMENT.find((p) => p.id === commande.paiement);
  return (
    <Pressable onPress={onPress}>
      <Carte>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Commande #{commande.id}</Text>
          <Badge texte={statut.label} couleur={statut.couleur} />
        </View>
        <Text style={styles.doux}>🏪 {commande.commercant.nom}</Text>
        {commande.articles.map((a) => (
          <Text key={a.produitId}>
            {a.quantite} × {a.nom}
          </Text>
        ))}
        <Text style={{ marginTop: 6, fontWeight: '600' }}>
          Total : {formatPrix(commande.total + commande.fraisLivraison)}
        </Text>
        <Text style={styles.doux}>
          {paiement?.icone} {paiement?.label} · {commande.statutPaiement === 'paye' ? 'Payé' : 'À payer'} ·{' '}
          {formatDate(commande.date)}
        </Text>
        {onPress && <Text style={{ color: couleurs.client, marginTop: 6 }}>Voir le suivi ›</Text>}
      </Carte>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titre: { fontWeight: '700', fontSize: 16, marginBottom: 6 },
  doux: { color: couleurs.texteDoux, marginTop: 2 },
});
