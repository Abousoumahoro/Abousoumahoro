import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ListeNotifications, ResumeCommande } from '../../components/Communs';
import { Bouton, Carte, EnTete, Onglets, Vide } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { CATEGORIES, COMMERCANTS, MOYENS_PAIEMENT } from '../../data/mock';
import { couleurs } from '../../theme';
import { formatPrix } from '../../utils';
import SuiviCommande from '../SuiviCommande';

const COULEUR = couleurs.client;

export default function EspaceClient({ onQuitter }) {
  const { panier, notifications } = useApp();
  const [onglet, setOnglet] = useState('boutique');
  const [suiviId, setSuiviId] = useState(null);

  if (suiviId) {
    return <SuiviCommande commandeId={suiviId} couleur={COULEUR} onRetour={() => setSuiviId(null)} />;
  }

  const nbPanier = panier.reduce((s, l) => s + l.quantite, 0);
  const nbNotifs = notifications.filter((n) => n.destinataire === 'client').length;

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre="Espace Client" couleur={COULEUR} onRetour={onQuitter} />
      <View style={{ flex: 1 }}>
        {onglet === 'boutique' && <Boutique />}
        {onglet === 'panier' && (
          <Panier
            onCommandeOk={(id) => {
              setOnglet('commandes');
              setSuiviId(id);
            }}
          />
        )}
        {onglet === 'commandes' && <Historique onSuivre={setSuiviId} />}
        {onglet === 'notifs' && <ListeNotifications destinataire="client" />}
      </View>
      <Onglets
        couleur={COULEUR}
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'boutique', label: 'Boutique', icone: '🏬' },
          { id: 'panier', label: 'Panier', icone: '🛒', compteur: nbPanier },
          { id: 'commandes', label: 'Commandes', icone: '📋' },
          { id: 'notifs', label: 'Notifications', icone: '🔔', compteur: nbNotifs },
        ]}
      />
    </View>
  );
}

function Boutique() {
  const { produits, ajouterAuPanier } = useApp();
  const [categorie, setCategorie] = useState('repas');
  const liste = produits.filter((p) => p.categorie === categorie);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.categories}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategorie(c.id)}
            style={[styles.categorie, categorie === c.id && { backgroundColor: COULEUR }]}
          >
            <Text style={[styles.categorieTexte, categorie === c.id && { color: '#fff' }]}>
              {c.icone} {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        data={liste}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<Vide texte="Aucun article dans cette catégorie." />}
        renderItem={({ item }) => (
          <Carte style={styles.produit}>
            <View style={{ flex: 1 }}>
              <Text style={styles.produitNom}>{item.nom}</Text>
              <Text style={styles.doux}>{item.description}</Text>
              <Text style={styles.doux}>🏪 {COMMERCANTS.find((m) => m.id === item.commercantId)?.nom}</Text>
              <Text style={styles.prix}>{formatPrix(item.prix)}</Text>
            </View>
            <Bouton titre="+ Ajouter" couleur={COULEUR} onPress={() => ajouterAuPanier(item)} />
          </Carte>
        )}
      />
    </View>
  );
}

function Panier({ onCommandeOk }) {
  const { panier, ajouterAuPanier, retirerDuPanier, passerCommande } = useApp();
  const [paiement, setPaiement] = useState(null);

  if (panier.length === 0) return <Vide texte="Votre panier est vide." />;

  const sousTotal = panier.reduce((s, l) => s + l.produit.prix * l.quantite, 0);
  const nbCommercants = new Set(panier.map((l) => l.produit.commercantId)).size;
  const frais = 1000 * nbCommercants;

  const commander = () => {
    const nouvelles = passerCommande(paiement);
    const moyen = MOYENS_PAIEMENT.find((p) => p.id === paiement);
    Alert.alert(
      'Commande envoyée ✅',
      paiement === 'livraison'
        ? 'Vous paierez au livreur à la réception.'
        : `Paiement par ${moyen.label} (simulation de démo).`,
    );
    onCommandeOk(nouvelles[0].id);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {panier.map((l) => (
        <Carte key={l.produit.id} style={styles.produit}>
          <View style={{ flex: 1 }}>
            <Text style={styles.produitNom}>{l.produit.nom}</Text>
            <Text style={styles.doux}>{formatPrix(l.produit.prix * l.quantite)}</Text>
          </View>
          <View style={styles.quantite}>
            <Bouton titre="−" contour couleur={COULEUR} onPress={() => retirerDuPanier(l.produit.id)} />
            <Text style={styles.quantiteTexte}>{l.quantite}</Text>
            <Bouton titre="+" contour couleur={COULEUR} onPress={() => ajouterAuPanier(l.produit)} />
          </View>
        </Carte>
      ))}

      <Carte>
        <Text>Sous-total : {formatPrix(sousTotal)}</Text>
        <Text>Livraison : {formatPrix(frais)}</Text>
        <Text style={[styles.produitNom, { marginTop: 4 }]}>Total : {formatPrix(sousTotal + frais)}</Text>
      </Carte>

      <Text style={styles.section}>Moyen de paiement</Text>
      {MOYENS_PAIEMENT.map((m) => (
        <Pressable key={m.id} onPress={() => setPaiement(m.id)}>
          <Carte style={[styles.paiement, paiement === m.id && { borderColor: COULEUR, borderWidth: 2 }]}>
            <Text style={{ fontSize: 16 }}>
              {paiement === m.id ? '🔘' : '⚪'} {m.icone} {m.label}
            </Text>
          </Carte>
        </Pressable>
      ))}

      <Bouton
        titre={paiement ? 'Commander' : 'Choisissez un moyen de paiement'}
        couleur={COULEUR}
        desactive={!paiement}
        onPress={commander}
        style={{ marginTop: 8, marginBottom: 24 }}
      />
    </ScrollView>
  );
}

function Historique({ onSuivre }) {
  const { commandes } = useApp();
  // Démo : toutes les commandes passées par des clients.
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={commandes}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={<Vide texte="Aucune commande." />}
      renderItem={({ item }) => <ResumeCommande commande={item} onPress={() => onSuivre(item.id)} />}
    />
  );
}

const styles = StyleSheet.create({
  categories: { flexDirection: 'row', padding: 12, gap: 8, flexWrap: 'wrap' },
  categorie: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  categorieTexte: { fontWeight: '600', color: couleurs.texte },
  produit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  produitNom: { fontSize: 16, fontWeight: '700' },
  prix: { fontSize: 15, fontWeight: '700', color: couleurs.primaire, marginTop: 4 },
  doux: { color: couleurs.texteDoux, marginTop: 2 },
  quantite: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantiteTexte: { fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  section: { fontSize: 16, fontWeight: '700', marginVertical: 8 },
  paiement: { paddingVertical: 12 },
});
