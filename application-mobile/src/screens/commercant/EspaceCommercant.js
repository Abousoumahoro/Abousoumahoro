import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ListeNotifications, ResumeCommande } from '../../components/Communs';
import {
  Bouton,
  BoutonDeconnexion,
  Carte,
  EnTete,
  EtatChargement,
  Onglets,
  Vide,
} from '../../components/ui';
import { CATEGORIES } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { useDonnees } from '../../hooks';
import { couleurs } from '../../theme';
import { formatPrix } from '../../utils';
import SuiviCommande from '../SuiviCommande';

const COULEUR = couleurs.commercant;

export default function EspaceCommercant({ onDeconnexion }) {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState('articles');
  const [suiviId, setSuiviId] = useState(null);

  if (suiviId) {
    return (
      <SuiviCommande commandeId={suiviId} couleur={COULEUR} onRetour={() => setSuiviId(null)} afficherClient />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <EnTete
        titre={`🏪 ${utilisateur.nomBoutique}`}
        couleur={COULEUR}
        droite={<BoutonDeconnexion onPress={onDeconnexion} />}
      />
      <View style={{ flex: 1 }}>
        {onglet === 'articles' && <MesArticles />}
        {onglet === 'publier' && <Publier onPublie={() => setOnglet('articles')} />}
        {onglet === 'commandes' && <Commandes onSuivre={setSuiviId} />}
        {onglet === 'notifs' && <ListeNotifications />}
      </View>
      <Onglets
        couleur={COULEUR}
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'articles', label: 'Mes articles', icone: '🏷️' },
          { id: 'publier', label: 'Publier', icone: '➕' },
          { id: 'commandes', label: 'Commandes', icone: '📋' },
          { id: 'notifs', label: 'Notifications', icone: '🔔' },
        ]}
      />
    </View>
  );
}

function MesArticles() {
  const { api } = useAuth();
  const { donnees, erreur, chargement, recharger } = useDonnees('/mes-produits');
  if (!donnees) return <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />;

  const retirer = (produit) =>
    Alert.alert('Retirer l\'article', `« ${produit.nom} » ne sera plus visible par les clients.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/produits/${produit.id}`, { methode: 'DELETE' });
            recharger();
          } catch (e) {
            Alert.alert('Erreur', e.message);
          }
        },
      },
    ]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={donnees}
      keyExtractor={(p) => String(p.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
      ListEmptyComponent={<Vide texte="Aucun article publié. Utilisez l'onglet « Publier »." />}
      renderItem={({ item }) => (
        <Carte style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titre}>{item.nom}</Text>
            <Text style={styles.doux}>
              {CATEGORIES.find((c) => c.id === item.categorie)?.label}
              {item.description ? ` · ${item.description}` : ''}
            </Text>
            <Text style={styles.prix}>{formatPrix(item.prix)}</Text>
          </View>
          <Bouton titre="Retirer" contour couleur={couleurs.danger} onPress={() => retirer(item)} />
        </Carte>
      )}
    />
  );
}

function Publier({ onPublie }) {
  const { api } = useAuth();
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('repas');
  const [envoi, setEnvoi] = useState(false);

  const prixNombre = parseInt(prix.replace(/\D/g, ''), 10);
  const valide = nom.trim().length > 0 && prixNombre > 0 && !envoi;

  const publier = async () => {
    setEnvoi(true);
    try {
      await api('/produits', {
        methode: 'POST',
        corps: { nom: nom.trim(), prix: prixNombre, description: description.trim(), categorie },
      });
      Alert.alert('Article publié ✅', `« ${nom.trim()} » est visible par les clients.`);
      onPublie();
    } catch (e) {
      Alert.alert('Publication impossible', e.message);
      setEnvoi(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Nom de l'article</Text>
      <TextInput style={styles.champ} value={nom} onChangeText={setNom} placeholder="Ex : Poulet braisé" />

      <Text style={styles.label}>Prix (FCFA)</Text>
      <TextInput
        style={styles.champ}
        value={prix}
        onChangeText={setPrix}
        keyboardType="number-pad"
        placeholder="Ex : 3000"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.champ, { height: 80, textAlignVertical: 'top' }]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Détails, taille, ingrédients…"
      />

      <Text style={styles.label}>Catégorie</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCategorie(c.id)}
            style={[styles.puce, categorie === c.id && { backgroundColor: COULEUR, borderColor: COULEUR }]}
          >
            <Text style={[{ fontWeight: '600' }, categorie === c.id && { color: '#fff' }]}>
              {c.icone} {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Bouton
        titre={envoi ? 'Publication…' : 'Publier l\'article'}
        couleur={COULEUR}
        desactive={!valide}
        onPress={publier}
      />
    </ScrollView>
  );
}

function Commandes({ onSuivre }) {
  const { donnees, erreur, chargement, recharger } = useDonnees('/commandes', 5000);
  if (!donnees) return <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />;
  const ventes = donnees.filter((c) => c.statut === 'livree').reduce((s, c) => s + c.total, 0);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={donnees}
      keyExtractor={(c) => String(c.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
      ListHeaderComponent={
        <Carte style={{ backgroundColor: COULEUR, borderColor: COULEUR }}>
          <Text style={{ color: '#fff' }}>Ventes livrées</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{formatPrix(ventes)}</Text>
        </Carte>
      }
      ListEmptyComponent={<Vide texte="Aucune commande pour le moment." />}
      renderItem={({ item }) => <ResumeCommande commande={item} onPress={() => onSuivre(item.id)} />}
    />
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 16, fontWeight: '700' },
  doux: { color: couleurs.texteDoux, marginTop: 2 },
  prix: { fontSize: 15, fontWeight: '700', color: couleurs.primaire, marginTop: 4 },
  label: { fontWeight: '700', marginBottom: 6 },
  champ: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  puce: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: '#fff',
  },
});
