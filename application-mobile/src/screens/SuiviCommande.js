import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CarteTrajet from '../components/CarteTrajet';
import { FicheContact, ResumeCommande } from '../components/Communs';
import { Carte, EnTete, EtatChargement } from '../components/ui';
import { STATUTS } from '../constantes';
import { useDonnees } from '../hooks';
import { couleurs } from '../theme';
import { distanceKm } from '../utils';

// Suivi en direct d'un colis sur la carte, du point A au point B (client et commerçant).
export default function SuiviCommande({ commandeId, couleur, onRetour, afficherClient }) {
  const { donnees: commande, erreur, chargement, recharger } = useDonnees(`/commandes/${commandeId}`, 2000);

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre={`Suivi #${commandeId}`} couleur={couleur} onRetour={onRetour} />
      {!commande ? (
        <EtatChargement chargement={chargement} erreur={erreur} onReessayer={recharger} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <CarteTrajet commande={commande} />
          <Carte>
            <Text style={[styles.statut, { color: STATUTS[commande.statut].couleur }]}>
              {STATUTS[commande.statut].label}
            </Text>
            <View style={styles.barre}>
              <View
                style={[
                  styles.barreRemplie,
                  {
                    width: `${Math.round(commande.progression * 100)}%`,
                    backgroundColor: STATUTS[commande.statut].couleur,
                  },
                ]}
              />
            </View>
            <Text>🅰️ {commande.commercant.nom} — {commande.commercant.adresse}</Text>
            <Text>🅱️ {commande.adresseLivraison}</Text>
            {commande.statut === 'en_cours' && commande.positionLivreur && (
              <Text style={{ marginTop: 6, color: couleurs.texteDoux }}>
                Distance restante : {distanceKm(commande.positionLivreur, commande.arrivee).toFixed(1)} km
              </Text>
            )}
          </Carte>
          {commande.livreur ? (
            <FicheContact
              titre="🛵 Livreur"
              nom={commande.livreur.nom}
              telephone={commande.livreur.telephone}
              detail={commande.livreur.vehicule}
            />
          ) : (
            <Carte>
              <Text>⏳ En attente qu'un livreur accepte le colis…</Text>
            </Carte>
          )}
          {afficherClient && (
            <FicheContact titre="🙋 Client" nom={commande.client.nom} telephone={commande.client.telephone} />
          )}
          <ResumeCommande commande={commande} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statut: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  barre: { height: 8, borderRadius: 4, backgroundColor: couleurs.bordure, marginBottom: 10, overflow: 'hidden' },
  barreRemplie: { height: 8 },
});
