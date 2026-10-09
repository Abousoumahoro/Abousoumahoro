import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import CarteTrajet from '../../components/CarteTrajet';
import { FicheContact, ListeNotifications } from '../../components/Communs';
import {
  Badge,
  Bouton,
  BoutonDeconnexion,
  Carte,
  EnTete,
  EtatChargement,
  Onglets,
  Vide,
} from '../../components/ui';
import { STATUTS } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { useChoixGps, useSuiviGps } from '../../gps';
import { useDonnees } from '../../hooks';
import { couleurs } from '../../theme';
import { distanceKm, formatPrix } from '../../utils';

const COULEUR = couleurs.livreur;

export default function EspaceLivreur({ onDeconnexion }) {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState('disponibles');
  const [colisId, setColisId] = useState(null);
  const [gpsActif, setGpsActif] = useChoixGps();
  // Le suivi GPS reste actif quel que soit l'écran affiché.
  const etatGps = useSuiviGps(gpsActif);

  if (colisId) {
    return (
      <DetailLivraison commandeId={colisId} gpsActif={gpsActif} onRetour={() => setColisId(null)} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <EnTete
        titre={`🛵 ${utilisateur.nom.split(' ')[0]}`}
        couleur={COULEUR}
        droite={<BoutonDeconnexion onPress={onDeconnexion} />}
      />
      <View style={styles.gps}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>📍 GPS réel</Text>
          <Text style={styles.doux} numberOfLines={1}>
            {gpsActif ? etatGps : 'Désactivé : trajet simulé (démo)'}
          </Text>
        </View>
        <Switch value={gpsActif} onValueChange={setGpsActif} trackColor={{ true: COULEUR }} />
      </View>
      <View style={{ flex: 1 }}>
        {onglet === 'disponibles' && <ColisDisponibles onAcceptes={() => setOnglet('livraisons')} />}
        {onglet === 'livraisons' && <MesLivraisons onOuvrir={setColisId} />}
        {onglet === 'notifs' && <ListeNotifications />}
      </View>
      <Onglets
        couleur={COULEUR}
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'disponibles', label: 'Colis proches', icone: '📍' },
          { id: 'livraisons', label: 'Mes livraisons', icone: '🛵' },
          { id: 'notifs', label: 'Notifications', icone: '🔔' },
        ]}
      />
    </View>
  );
}

// Colis disponibles à proximité ; sélection d'un ou plusieurs colis.
function ColisDisponibles({ onAcceptes }) {
  const { api } = useAuth();
  const { donnees, erreur, chargement, recharger } = useDonnees('/livreur/colis-proches', 5000);
  const [selection, setSelection] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  if (!donnees) return <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />;

  // Ne garder sélectionnés que les colis encore disponibles.
  const choisis = selection.filter((id) => donnees.some((c) => c.id === id));
  const basculer = (id) =>
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const accepter = async () => {
    setEnvoi(true);
    try {
      const { acceptes, dejaPris } = await api('/livreur/accepter', { methode: 'POST', corps: { ids: choisis } });
      setSelection([]);
      Alert.alert(
        `${acceptes.length} colis accepté(s)`,
        (dejaPris.length ? `${dejaPris.length} colis déjà pris par un autre livreur.\n\n` : '') +
          'Avant de partir, vérifiez toujours l\'intérieur de chaque colis.',
      );
      if (acceptes.length) onAcceptes();
      else recharger();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={donnees}
        keyExtractor={(c) => String(c.id)}
        refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
        ListHeaderComponent={<Text style={styles.doux}>Colis à proximité, du plus proche au plus loin :</Text>}
        ListEmptyComponent={<Vide texte="Aucun colis disponible à proximité." />}
        renderItem={({ item }) => {
          const choisi = choisis.includes(item.id);
          return (
            <Pressable onPress={() => basculer(item.id)}>
              <Carte style={choisi && { borderColor: COULEUR, borderWidth: 2 }}>
                <View style={styles.ligne}>
                  <Text style={styles.titre}>
                    {choisi ? '☑️' : '⬜'} Colis #{item.id}
                  </Text>
                  <Text style={{ fontWeight: '700', color: COULEUR }}>{item.distance.toFixed(1)} km</Text>
                </View>
                <Text>🅰️ {item.commercant.nom} — {item.commercant.adresse}</Text>
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
      {choisis.length > 0 && (
        <View style={styles.pied}>
          <Bouton
            titre={envoi ? 'Envoi…' : `Prendre ${choisis.length} colis`}
            couleur={COULEUR}
            desactive={envoi}
            onPress={accepter}
          />
        </View>
      )}
    </View>
  );
}

function MesLivraisons({ onOuvrir }) {
  const { donnees, erreur, chargement, recharger } = useDonnees('/commandes', 5000);
  if (!donnees) return <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={donnees}
      keyExtractor={(c) => String(c.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={recharger} />}
      ListEmptyComponent={<Vide texte="Aucune livraison. Prenez un colis dans « Colis proches »." />}
      renderItem={({ item }) => {
        const statut = STATUTS[item.statut];
        return (
          <Pressable onPress={() => onOuvrir(item.id)}>
            <Carte>
              <View style={styles.ligne}>
                <Text style={styles.titre}>Colis #{item.id}</Text>
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
function DetailLivraison({ commandeId, gpsActif, onRetour }) {
  const { api } = useAuth();
  const { donnees: commande, erreur, chargement, recharger } = useDonnees(`/commandes/${commandeId}`, 2000);
  const [coches, setCoches] = useState({});
  const [interieurOk, setInterieurOk] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const action = async (chemin, corps) => {
    setEnvoi(true);
    try {
      await api(chemin, { methode: 'POST', corps });
      await recharger();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setEnvoi(false);
    }
  };

  if (!commande) {
    return (
      <View style={{ flex: 1 }}>
        <EnTete titre={`Colis #${commandeId}`} couleur={COULEUR} onRetour={onRetour} />
        <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />
      </View>
    );
  }

  const tousCoches = commande.articles.every((a) => coches[a.produitId]);
  const peutPartir = tousCoches && interieurOk && !envoi;
  const aEncaisser =
    commande.statutPaiement !== 'paye' ? commande.total + commande.fraisLivraison : 0;

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre={`Colis #${commande.id}`} couleur={COULEUR} onRetour={onRetour} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <CarteTrajet commande={commande} />
        <Carte>
          <Text>🅰️ Retrait : {commande.commercant.nom} — {commande.commercant.adresse}</Text>
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
              titre={envoi ? 'Envoi…' : tousCoches && interieurOk ? '🛵 Partir vers le point B' : 'Cochez toutes les cases'}
              couleur={COULEUR}
              desactive={!peutPartir}
              onPress={() =>
                action(`/commandes/${commande.id}/verification`, {
                  articlesVerifies: commande.articles.filter((a) => coches[a.produitId]).map((a) => a.produitId),
                  interieurOk,
                })
              }
              style={{ marginTop: 10 }}
            />
          </Carte>
        )}

        {commande.statut === 'en_cours' && (
          <Carte>
            <Text style={styles.titre}>🛵 En route vers le point B…</Text>
            <Text style={styles.doux}>
              {gpsActif
                ? 'Votre position GPS est partagée avec le client et le commerçant.'
                : 'Trajet simulé. Activez « GPS réel » pour partager votre vraie position.'}
            </Text>
            {commande.positionLivreur && (
              <Text style={styles.doux}>
                Restant : {distanceKm(commande.positionLivreur, commande.arrivee).toFixed(1)} km
              </Text>
            )}
            <Bouton
              titre="✅ J'ai remis le colis"
              couleur={COULEUR}
              desactive={envoi}
              onPress={() => action(`/commandes/${commande.id}/livree`)}
              style={{ marginTop: 10 }}
            />
          </Carte>
        )}

        {commande.statut === 'livree' && (
          <Carte>
            <Text style={[styles.titre, { color: COULEUR }]}>✅ Colis livré</Text>
          </Carte>
        )}

        <FicheContact titre="🙋 Client" nom={commande.client.nom} telephone={commande.client.telephone} />
        <FicheContact titre="🏪 Commerçant" nom={commande.commercant.nom} telephone={commande.commercant.telephone} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  titre: { fontSize: 16, fontWeight: '700' },
  doux: { color: couleurs.texteDoux, marginTop: 2 },
  pied: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: couleurs.bordure },
  case: { paddingVertical: 8 },
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
});
