import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { Bouton, Carte, EnTete } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { couleurs } from '../../theme';
import { formatPrix } from '../../utils';

const FOURNISSEURS = {
  wave: { nom: 'Wave', couleur: '#1dc8ff', icone: '🌊' },
  orange: { nom: 'Orange Money', couleur: '#ff7900', icone: '🟠' },
};

// Ouvre Wave / Orange Money, puis attend la confirmation du serveur.
export default function EcranPaiement({ paiement: initial, onReussi, onEchec }) {
  const { api } = useAuth();
  const [paiement, setPaiement] = useState(initial);
  const [occupe, setOccupe] = useState(false);
  const termine = useRef(false);
  const rappels = useRef({ onReussi, onEchec });
  rappels.current = { onReussi, onEchec };
  const f = FOURNISSEURS[initial.fournisseur];

  const ouvrir = useCallback(() => {
    Linking.openURL(initial.url).catch(() =>
      Alert.alert('Impossible d\'ouvrir la page de paiement', initial.url),
    );
  }, [initial.url]);

  const appliquer = useCallback(
    (p) => {
      setPaiement(p);
      if (termine.current) return;
      if (p.statut === 'reussi') {
        termine.current = true;
        rappels.current.onReussi();
      } else if (p.statut === 'echoue') {
        termine.current = true;
        Alert.alert('Paiement non abouti', 'Votre panier est conservé : vous pouvez réessayer ou choisir un autre moyen de paiement.');
        rappels.current.onEchec();
      }
    },
    [],
  );

  const verifier = useCallback(async () => {
    try {
      appliquer(await api(`/paiements/${initial.id}/verifier`, { methode: 'POST' }));
    } catch {
      // nouvel essai au prochain rafraîchissement
    }
  }, [api, appliquer, initial.id]);

  // Ouverture automatique de Wave / Orange Money.
  useEffect(() => {
    ouvrir();
  }, [ouvrir]);

  // Suivi du statut : toutes les 3 s, et dès que le client revient dans l'application.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        appliquer(await api(`/paiements/${initial.id}`));
      } catch {
        // on réessaiera
      }
    }, 3000);
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') verifier();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [api, appliquer, verifier, initial.id]);

  const action = async (fn) => {
    setOccupe(true);
    await fn();
    setOccupe(false);
  };

  const annuler = () =>
    action(async () => {
      try {
        appliquer(await api(`/paiements/${initial.id}/annuler`, { methode: 'POST' }));
      } catch (e) {
        Alert.alert('Erreur', e.message);
      }
    });

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre={`Paiement ${f.nom}`} couleur={f.couleur} />
      <View style={{ padding: 20 }}>
        <Carte style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontSize: 48 }}>{f.icone}</Text>
          <Text style={styles.montant}>{formatPrix(paiement.montant)}</Text>
          {paiement.statut === 'en_attente' && (
            <>
              <ActivityIndicator size="large" color={f.couleur} style={{ marginVertical: 12 }} />
              <Text style={styles.texte}>
                Validez le paiement dans {f.nom}, puis revenez ici.{'\n'}La confirmation s'affichera automatiquement.
              </Text>
            </>
          )}
          {paiement.simulation && (
            <Text style={[styles.texte, { marginTop: 10, color: couleurs.texteDoux }]}>
              🧪 Mode simulation : aucun argent n'est débité.
            </Text>
          )}
        </Carte>
        <Bouton titre={`Ouvrir ${f.nom}`} couleur={f.couleur} onPress={ouvrir} />
        <Bouton
          titre={occupe ? 'Vérification…' : 'J\'ai payé — vérifier'}
          contour
          couleur={couleurs.client}
          desactive={occupe}
          onPress={() => action(verifier)}
          style={{ marginTop: 10 }}
        />
        <Bouton
          titre="Annuler le paiement"
          contour
          couleur={couleurs.danger}
          desactive={occupe}
          onPress={annuler}
          style={{ marginTop: 10 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  montant: { fontSize: 28, fontWeight: '800', marginTop: 8 },
  texte: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
