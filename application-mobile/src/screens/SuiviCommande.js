import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CarteTrajet from '../components/CarteTrajet';
import { FicheLivreur, ResumeCommande } from '../components/Communs';
import { Carte, EnTete } from '../components/ui';
import { useApp } from '../context/AppContext';
import { COMMERCANTS, STATUTS } from '../data/mock';
import { couleurs } from '../theme';
import { distanceKm } from '../utils';

// Suivi d'un colis sur la carte du point A au point B (client et commerçant).
export default function SuiviCommande({ commandeId, couleur, onRetour }) {
  const { commandes } = useApp();
  const commande = commandes.find((c) => c.id === commandeId);
  if (!commande) return null;
  const commercant = COMMERCANTS.find((m) => m.id === commande.commercantId);
  const statut = STATUTS[commande.statut];
  const restantKm = distanceKm(commande.depart, commande.arrivee) * (1 - commande.progression);

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre={`Suivi ${commande.id}`} couleur={couleur} onRetour={onRetour} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <CarteTrajet commande={commande} />
        <Carte>
          <Text style={[styles.statut, { color: statut.couleur }]}>{statut.label}</Text>
          <View style={styles.barre}>
            <View
              style={[styles.barreRemplie, { width: `${Math.round(commande.progression * 100)}%`, backgroundColor: statut.couleur }]}
            />
          </View>
          <Text>🅰️ {commercant?.nom} — {commercant?.adresse}</Text>
          <Text>🅱️ {commande.adresseLivraison}</Text>
          {commande.statut === 'en_cours' && (
            <Text style={{ marginTop: 6, color: couleurs.texteDoux }}>
              Distance restante : {restantKm.toFixed(1)} km
            </Text>
          )}
        </Carte>
        {commande.livreurId ? (
          <FicheLivreur />
        ) : (
          <Carte>
            <Text>⏳ En attente qu'un livreur accepte le colis…</Text>
          </Carte>
        )}
        <ResumeCommande commande={commande} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statut: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  barre: { height: 8, borderRadius: 4, backgroundColor: couleurs.bordure, marginBottom: 10, overflow: 'hidden' },
  barreRemplie: { height: 8 },
});
