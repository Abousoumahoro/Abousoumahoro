import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { LIVREUR, MOYENS_PAIEMENT, STATUTS } from '../data/mock';
import { couleurs } from '../theme';
import { formatDate, formatPrix } from '../utils';
import { Badge, Bouton, Carte, Vide } from './ui';

export function ListeNotifications({ destinataire }) {
  const { notifications } = useApp();
  const liste = notifications.filter((n) => n.destinataire === destinataire);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={liste}
      keyExtractor={(n) => n.id}
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

// Coordonnées du livreur, avec boutons appeler / SMS / WhatsApp.
export function FicheLivreur() {
  const tel = LIVREUR.telephone.replace(/\s/g, '');
  return (
    <Carte>
      <Text style={styles.titre}>🛵 Votre livreur</Text>
      <Text style={{ fontSize: 16, fontWeight: '600' }}>{LIVREUR.nom}</Text>
      <Text style={styles.doux}>{LIVREUR.vehicule}</Text>
      <Text style={styles.doux}>{LIVREUR.telephone}</Text>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Commande {commande.id}</Text>
          <Badge texte={statut.label} couleur={statut.couleur} />
        </View>
        {commande.articles.map((a) => (
          <Text key={a.produitId}>
            {a.quantite} × {a.nom}
          </Text>
        ))}
        <Text style={{ marginTop: 6, fontWeight: '600' }}>
          Total : {formatPrix(commande.total + commande.fraisLivraison)}
        </Text>
        <Text style={styles.doux}>
          {paiement?.icone} {paiement?.label} · {formatDate(commande.date)}
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
