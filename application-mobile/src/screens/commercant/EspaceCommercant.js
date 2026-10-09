import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ListeNotifications, ResumeCommande } from '../../components/Communs';
import { Bouton, Carte, EnTete, Onglets, Vide } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { CATEGORIES, COMMERCANT_CONNECTE } from '../../data/mock';
import { couleurs } from '../../theme';
import { formatPrix } from '../../utils';
import SuiviCommande from '../SuiviCommande';

const COULEUR = couleurs.commercant;

export default function EspaceCommercant({ onQuitter }) {
  const { notifications } = useApp();
  const [onglet, setOnglet] = useState('articles');
  const [suiviId, setSuiviId] = useState(null);

  if (suiviId) {
    return <SuiviCommande commandeId={suiviId} couleur={COULEUR} onRetour={() => setSuiviId(null)} />;
  }

  const nbNotifs = notifications.filter((n) => n.destinataire === 'commercant').length;

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre="Espace Commerçant" couleur={COULEUR} onRetour={onQuitter} />
      <View style={{ flex: 1 }}>
        {onglet === 'articles' && <MesArticles />}
        {onglet === 'publier' && <Publier onPublie={() => setOnglet('articles')} />}
        {onglet === 'commandes' && <Commandes onSuivre={setSuiviId} />}
        {onglet === 'notifs' && <ListeNotifications destinataire="commercant" />}
      </View>
      <Onglets
        couleur={COULEUR}
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'articles', label: 'Mes articles', icone: '🏷️' },
          { id: 'publier', label: 'Publier', icone: '➕' },
          { id: 'commandes', label: 'Commandes', icone: '📋' },
          { id: 'notifs', label: 'Notifications', icone: '🔔', compteur: nbNotifs },
        ]}
      />
    </View>
  );
}

function MesArticles() {
  const { produits } = useApp();
  const miens = produits.filter((p) => p.commercantId === COMMERCANT_CONNECTE);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={miens}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={<Vide texte="Aucun article publié." />}
      renderItem={({ item }) => (
        <Carte>
          <Text style={styles.titre}>{item.nom}</Text>
          <Text style={styles.doux}>
            {CATEGORIES.find((c) => c.id === item.categorie)?.label} · {item.description}
          </Text>
          <Text style={styles.prix}>{formatPrix(item.prix)}</Text>
        </Carte>
      )}
    />
  );
}

function Publier({ onPublie }) {
  const { publierProduit } = useApp();
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('repas');

  const prixNombre = parseInt(prix.replace(/\D/g, ''), 10);
  const valide = nom.trim().length > 0 && prixNombre > 0;

  const publier = () => {
    publierProduit({
      commercantId: COMMERCANT_CONNECTE,
      nom: nom.trim(),
      prix: prixNombre,
      description: description.trim(),
      categorie,
    });
    Alert.alert('Article publié ✅', `« ${nom.trim()} » est visible par les clients.`);
    setNom('');
    setPrix('');
    setDescription('');
    onPublie();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Nom de l'article</Text>
      <TextInput style={styles.champ} value={nom} onChangeText={setNom} placeholder="Ex : Poulet braisé" />

      <Text style={styles.label}>Prix (FCFA)</Text>
      <TextInput style={styles.champ} value={prix} onChangeText={setPrix} keyboardType="number-pad" placeholder="Ex : 3000" />

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

      <Bouton titre="Publier l'article" couleur={COULEUR} desactive={!valide} onPress={publier} />
    </ScrollView>
  );
}

function Commandes({ onSuivre }) {
  const { commandes } = useApp();
  const miennes = commandes.filter((c) => c.commercantId === COMMERCANT_CONNECTE);
  const ventes = miennes.filter((c) => c.statut === 'livree').reduce((s, c) => s + c.total, 0);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={miennes}
      keyExtractor={(c) => c.id}
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
