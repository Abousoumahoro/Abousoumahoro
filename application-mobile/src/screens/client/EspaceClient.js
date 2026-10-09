import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ListeNotifications, ResumeCommande } from '../../components/Communs';
import { BoutonDeconnexion, Bouton, Carte, EnTete, EtatChargement, Onglets, Vide } from '../../components/ui';
import { CATEGORIES, MOYENS_PAIEMENT } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { useDonnees } from '../../hooks';
import { couleurs } from '../../theme';
import { formatPrix } from '../../utils';
import SuiviCommande from '../SuiviCommande';

const COULEUR = couleurs.client;
const FRAIS_LIVRAISON = 1000;

export default function EspaceClient({ onDeconnexion }) {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState('boutique');
  const [suiviId, setSuiviId] = useState(null);
  // Panier : [{ produit, quantite }]
  const [panier, setPanier] = useState([]);

  if (suiviId) {
    return <SuiviCommande commandeId={suiviId} couleur={COULEUR} onRetour={() => setSuiviId(null)} />;
  }

  const ajouter = (produit) =>
    setPanier((p) => {
      const ligne = p.find((l) => l.produit.id === produit.id);
      if (ligne) return p.map((l) => (l === ligne ? { ...l, quantite: l.quantite + 1 } : l));
      return [...p, { produit, quantite: 1 }];
    });
  const retirer = (produitId) =>
    setPanier((p) =>
      p
        .map((l) => (l.produit.id === produitId ? { ...l, quantite: l.quantite - 1 } : l))
        .filter((l) => l.quantite > 0),
    );

  const nbPanier = panier.reduce((s, l) => s + l.quantite, 0);

  return (
    <View style={{ flex: 1 }}>
      <EnTete
        titre={`Bonjour ${utilisateur.nom.split(' ')[0]}`}
        couleur={COULEUR}
        droite={<BoutonDeconnexion onPress={onDeconnexion} />}
      />
      <View style={{ flex: 1 }}>
        {onglet === 'boutique' && <Boutique onAjouter={ajouter} />}
        {onglet === 'panier' && (
          <Panier
            panier={panier}
            onAjouter={ajouter}
            onRetirer={retirer}
            onCommandeOk={(id) => {
              setPanier([]);
              setOnglet('commandes');
              setSuiviId(id);
            }}
          />
        )}
        {onglet === 'commandes' && <Historique onSuivre={setSuiviId} />}
        {onglet === 'notifs' && <ListeNotifications />}
      </View>
      <Onglets
        couleur={COULEUR}
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'boutique', label: 'Boutique', icone: '🏬' },
          { id: 'panier', label: 'Panier', icone: '🛒', compteur: nbPanier },
          { id: 'commandes', label: 'Commandes', icone: '📋' },
          { id: 'notifs', label: 'Notifications', icone: '🔔' },
        ]}
      />
    </View>
  );
}

function Boutique({ onAjouter }) {
  const [categorie, setCategorie] = useState('repas');
  const { donnees, erreur, chargement, recharger } = useDonnees(`/produits?categorie=${categorie}`);

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
      {!donnees ? (
        <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          data={donnees}
          keyExtractor={(p) => String(p.id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
          ListEmptyComponent={<Vide texte="Aucun article dans cette catégorie." />}
          renderItem={({ item }) => (
            <Carte style={styles.produit}>
              <View style={{ flex: 1 }}>
                <Text style={styles.produitNom}>{item.nom}</Text>
                {item.description ? <Text style={styles.doux}>{item.description}</Text> : null}
                <Text style={styles.doux}>🏪 {item.commercant}</Text>
                <Text style={styles.prix}>{formatPrix(item.prix)}</Text>
              </View>
              <Bouton titre="+ Ajouter" couleur={COULEUR} onPress={() => onAjouter(item)} />
            </Carte>
          )}
        />
      )}
    </View>
  );
}

function Panier({ panier, onAjouter, onRetirer, onCommandeOk }) {
  const { api, utilisateur } = useAuth();
  const [paiement, setPaiement] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (panier.length === 0) return <Vide texte="Votre panier est vide." />;

  const sousTotal = panier.reduce((s, l) => s + l.produit.prix * l.quantite, 0);
  const frais = FRAIS_LIVRAISON * new Set(panier.map((l) => l.produit.commercantId)).size;

  const commander = async () => {
    setEnvoi(true);
    try {
      const creees = await api('/commandes', {
        methode: 'POST',
        corps: {
          paiement,
          articles: panier.map((l) => ({ produitId: l.produit.id, quantite: l.quantite })),
        },
      });
      const moyen = MOYENS_PAIEMENT.find((p) => p.id === paiement);
      Alert.alert(
        'Commande envoyée ✅',
        paiement === 'livraison'
          ? 'Vous paierez au livreur à la réception.'
          : `Paiement par ${moyen.label} (simulation de démo).`,
      );
      onCommandeOk(creees[0].id);
    } catch (e) {
      Alert.alert('Commande impossible', e.message);
    } finally {
      setEnvoi(false);
    }
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
            <Bouton titre="−" contour couleur={COULEUR} onPress={() => onRetirer(l.produit.id)} />
            <Text style={styles.quantiteTexte}>{l.quantite}</Text>
            <Bouton titre="+" contour couleur={COULEUR} onPress={() => onAjouter(l.produit)} />
          </View>
        </Carte>
      ))}

      <Carte>
        <Text>Sous-total : {formatPrix(sousTotal)}</Text>
        <Text>Livraison : {formatPrix(frais)}</Text>
        <Text style={[styles.produitNom, { marginTop: 4 }]}>Total : {formatPrix(sousTotal + frais)}</Text>
        <Text style={[styles.doux, { marginTop: 6 }]}>📍 Livraison : {utilisateur.adresse}</Text>
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
        titre={envoi ? 'Envoi…' : paiement ? 'Commander' : 'Choisissez un moyen de paiement'}
        couleur={COULEUR}
        desactive={!paiement || envoi}
        onPress={commander}
        style={{ marginTop: 8, marginBottom: 24 }}
      />
    </ScrollView>
  );
}

function Historique({ onSuivre }) {
  const { donnees, erreur, chargement, recharger } = useDonnees('/commandes', 5000);
  if (!donnees) return <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={donnees}
      keyExtractor={(c) => String(c.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
      ListEmptyComponent={<Vide texte="Aucune commande pour le moment." />}
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
