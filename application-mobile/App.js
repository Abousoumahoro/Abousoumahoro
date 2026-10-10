import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import GardeErreur from './src/components/GardeErreur';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import Authentification from './src/screens/Authentification';
import ChoixRole from './src/screens/ChoixRole';
import EspaceClient from './src/screens/client/EspaceClient';
import EspaceCommercant from './src/screens/commercant/EspaceCommercant';
import EspaceLivreur from './src/screens/livreur/EspaceLivreur';
import { useAlertesTelephone } from './src/notifications';
import { couleurs } from './src/theme';

const ESPACES = {
  client: EspaceClient,
  livreur: EspaceLivreur,
  commercant: EspaceCommercant,
};

export default function App() {
  return (
    <GardeErreur>
      <SafeAreaProvider>
        <AuthProvider>
          <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
            <GardeErreur>
              <Navigation />
            </GardeErreur>
          </SafeAreaView>
          <StatusBar style="dark" />
        </AuthProvider>
      </SafeAreaProvider>
    </GardeErreur>
  );
}

function Navigation() {
  const { utilisateur, demarrage, deconnexion } = useAuth();
  const [roleChoisi, setRoleChoisi] = useState(null);
  useAlertesTelephone();

  // Bouton « retour » Android : depuis la connexion, revenir au choix du profil.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!utilisateur && roleChoisi) {
        setRoleChoisi(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [utilisateur, roleChoisi]);

  if (demarrage) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  // Connecté : on ouvre directement l'espace correspondant au compte.
  if (utilisateur) {
    const Espace = ESPACES[utilisateur.role];
    return (
      <Espace
        onDeconnexion={() => {
          setRoleChoisi(null);
          deconnexion();
        }}
      />
    );
  }

  if (roleChoisi) return <Authentification role={roleChoisi} onRetour={() => setRoleChoisi(null)} />;
  return <ChoixRole onChoisir={setRoleChoisi} />;
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.fond },
});
