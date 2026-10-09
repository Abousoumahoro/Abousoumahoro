import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CarteTrajet from '../../components/CarteTrajet';
import { ListeNotifications } from '../../components/Communs';
import { Badge, Bouton, Carte, EnTete, Onglets, Vide } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { COMMERCANTS, LIVREUR, STATUTS } from '../../data/mock';
import { couleurs } from '../../theme';
import { distanceKm, formatPrix } from '../../utils';

const COULEUR = couleurs.livreur;
// Rayon dans lequel un colis est considéré "à proximité".
const RAYON_KM = 15;

export default function EspaceLivreur({ onQuitter }) {
  const { notifications } = useApp();
  const [onglet, setOnglet] = useState('disponibles');
  const [colisId, setColisId] = useState(null);

  if (colisId) {
    return <DetailLivraison commandeId={colisId} onRetour={() => setColisId(null)} />;
  }

  const nbNotifs = notifications.filter((n) => n.destinataire === 'livreur').length;

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre="Espace Livreur" couleur={COULEUR} onRetour={onQuitter} />
      <View style={{ flex: 1 }}>
        {onglet === 'disponibles' && <ColisDisponibles onAcceptes={() => setOnglet('livraisons')} />}
        {onglet === 'livraisons' && <MesLivraisons onOuvrir={setColisId} />}
        {onglet === 'notifs' && <ListeNotifications destinataire="livreur" />}
      </View>
      <Onglets
        couleur={COULEUR}
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'disponibles', label: 'Colis proches', icone: '📍' },
          { id: 'livraisons', label: 'Mes livraisons', icone: '🛵' },
          { id: 'notifs', label: 'Notifications', icone: '🔔', compteur: nbNotifs },
        ]}
      />
    </View>
  );
}

// Liste des colis disponibles à proximité, sélection d'un ou plusieurs colis.
function ColisDisponibles({ onAcceptes }) {
  const { commandes, accepterColis } = useApp();
  const [selection, setSelection] = useState([]);

  const proches = commandes
    .filter((c) => c.statut === 'en_attente')
    .map((c) => ({ ...c, distance: distanceKm(LIVREUR.position, c.depart) }))
    .filter((c) => c.distance <= RAYON_KM)
    .sort((a, b) => a.distance - b.distance);

  const basculer = (id) =>
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const accepter = () => {
    accepterColis(selection);
    Alert.alert(
      'Colis acceptés',
      'Avant de partir, vérifiez toujours l\'intérieur de chaque colis.',
    );
    setSelection([]);
    onAcceptes();
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={proches}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <Text style={styles.doux}>Colis à moins de {RAYON_KM} km de votre position :</Text>
        }
        ListEmptyComponent={<Vide texte="Aucun colis disponible à proximité." />}
        renderItem={({ item }) => {
          const choisi = selection.includes(item.id);
          const commercant = COMMERCANTS.find((m) => m.id === item.commercantId);
          return (
            <Pressable onPress={() => basculer(item.id)}>
              <Carte style={choisi && { borderColor: COULEUR, borderWidth: 2 }}>
                <View style={styles.ligne}>
                  <Text style={styles.titre}>
                    {choisi ? '☑️' : '⬜'} Colis {item.id}
                  </Text>
                  <Text style={{ fontWeight: '700', color: COULEUR }}>{item.distance.toFixed(1)} km</Text>
                </View>
                <Text>🅰️ {commercant?.nom} — {commercant?.adresse}</Text>
                <Text>🅱️ {item.adresseLivraison}</Text>
                <Text style={styles.doux}>
                  {item.articles.length} article(s) · Trajet {distanceKm(item.depart, item.arrivee).toFixed(1)} km
                </Text>
                <Text style={{ fontWeight: '700', marginTop: 4 }}>Gain : {formatPrix(item.fraisLivraison)}</Text>
              </Carte>
            </Pressable>
          );
        }}
      />
      {selection.length > 0 && (
        <View style={styles.pied}>
          <Bouton titre={`Prendre ${selection.length} colis`} couleur={COULEUR} onPress={accepter} />
        </View>
      )}
    </View>
  );
}

function MesLivraisons({ onOuvrir }) {
  const { commandes } = useApp();
  const miennes = commandes.filter((c) => c.livreurId === LIVREUR.id);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={miennes}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={<Vide texte="Aucune livraison. Prenez un colis dans « Colis proches »." />}
      renderItem={({ item }) => {
        const statut = STATUTS[item.statut];
        return (
          <Pressable onPress={() => onOuvrir(item.id)}>
            <Carte>
              <View style={styles.ligne}>
                <Text style={styles.titre}>Colis {item.id}</Text>
                <Badge texte={statut.label} couleur={statut.couleur} />
              </View>
              <Text>🅱️ {item.adresseLivraison}</Text>
              <Text style={{ color: COULEUR, marginTop: 6 }}>
                {item.statut === 'verification' ? 'Vérifier le colis ›' : 'Voir sur la carte ›'}
              </Text>
            </Carte>
          </Pressable>
        );
      }}
    />
  );
}

// Vérification obligatoire de l'intérieur du colis, puis trajet A → B sur la carte.
function DetailLivraison({ commandeId, onRetour }) {
  const { commandes, confirmerVerificationEtPartir } = useApp();
  const commande = commandes.find((c) => c.id === commandeId);
  const [coches, setCoches] = useState({});
  const [interieurOk, setInterieurOk] = useState(false);
  if (!commande) return null;

  const commercant = COMMERCANTS.find((m) => m.id === commande.commercantId);
  const tousCoches = commande.articles.every((a) => coches[a.produitId]);
  const peutPartir = tousCoches && interieurOk;
  const aEncaisser = commande.paiement === 'livraison' ? commande.total + commande.fraisLivraison : 0;

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre={`Colis ${commande.id}`} couleur={COULEUR} onRetour={onRetour} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <CarteTrajet commande={commande} />
        <Carte>
          <Text>🅰️ Retrait : {commercant?.nom} — {commercant?.adresse}</Text>
          <Text>🅱️ Livraison : {commande.adresseLivraison}</Text>
          {aEncaisser > 0 && (
            <Text style={{ marginTop: 6, fontWeight: '700', color: couleurs.danger }}>
              💵 À encaisser à la livraison : {formatPrix(aEncaisser)}
            </Text>
          )}
        </Carte>

        {commande.statut === 'verification' && (
          <Carte style={{ borderColor: '#8b5cf6', borderWidth: 2 }}>
            <Text style={styles.titre}>🔍 Vérification du colis (obligatoire)</Text>
            <Text style={[styles.doux, { marginBottom: 8 }]}>
              Ouvrez le colis et vérifiez chaque article avant de partir.
            </Text>
            {commande.articles.map((a) => (
              <Pressable
                key={a.produitId}
                style={styles.case}
                onPress={() => setCoches((c) => ({ ...c, [a.produitId]: !c[a.produitId] }))}
              >
                <Text style={{ fontSize: 16 }}>
                  {coches[a.produitId] ? '☑️' : '⬜'} {a.quantite} × {a.nom}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.case} onPress={() => setInterieurOk((v) => !v)}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>
                {interieurOk ? '☑️' : '⬜'} J'ai vérifié l'intérieur : contenu conforme et en bon état
              </Text>
            </Pressable>
            <Bouton
              titre={peutPartir ? '🛵 Partir vers le point B' : 'Cochez toutes les cases'}
              couleur={COULEUR}
              desactive={!peutPartir}
              onPress={() => confirmerVerificationEtPartir(commande.id)}
              style={{ marginTop: 10 }}
            />
          </Carte>
        )}

        {commande.statut === 'en_cours' && (
          <Carte>
            <Text style={styles.titre}>🛵 En route vers le point B…</Text>
            <Text style={styles.doux}>
              Restant : {(distanceKm(commande.depart, commande.arrivee) * (1 - commande.progression)).toFixed(1)} km
            </Text>
          </Carte>
        )}

        {commande.statut === 'livree' && (
          <Carte>
            <Text style={[styles.titre, { color: COULEUR }]}>✅ Colis livré</Text>
          </Carte>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  titre: { fontSize: 16, fontWeight: '700' },
  doux: { color: couleurs.texteDoux, marginTop: 2 },
  pied: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: couleurs.bordure },
  case: { paddingVertical: 8 },
});
