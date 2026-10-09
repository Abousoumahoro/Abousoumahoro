import Constants from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import CarteSchema from './CarteSchema';

// Sur Android, la carte Google exige une clé dans l'application compilée (sinon plantage).
// Expo Go fournit la sienne ; sur iPhone, Apple Plans n'en demande pas.
const dansExpoGo = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
const carteDisponible =
  Platform.OS === 'ios' || dansExpoGo || Constants.expoConfig?.extra?.carteGoogle === true;

// Carte affichant le trajet du point A (commerçant) au point B (client)
// et la position actuelle du livreur.
export default function CarteTrajet({ commande, hauteur = 280 }) {
  if (!carteDisponible) return <CarteSchema commande={commande} hauteur={hauteur} />;
  const { depart, arrivee, positionLivreur } = commande;
  const region = {
    latitude: (depart.latitude + arrivee.latitude) / 2,
    longitude: (depart.longitude + arrivee.longitude) / 2,
    latitudeDelta: Math.abs(depart.latitude - arrivee.latitude) * 1.8 + 0.01,
    longitudeDelta: Math.abs(depart.longitude - arrivee.longitude) * 1.8 + 0.01,
  };

  return (
    <View style={[styles.conteneur, { height: hauteur }]}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region}>
        <Marker coordinate={depart} title="Point A" description="Retrait du colis" pinColor="orange" />
        <Marker coordinate={arrivee} title="Point B" description="Livraison" pinColor="green" />
        <Polyline coordinates={[depart, arrivee]} strokeWidth={4} strokeColor="#2563eb" />
        {positionLivreur && (
          <Marker coordinate={positionLivreur} title="Livreur" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.livreur}>
              <View style={styles.livreurPoint} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  livreur: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livreurPoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
