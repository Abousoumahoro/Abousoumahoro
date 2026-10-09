import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import ChoixRole from './src/screens/ChoixRole';
import EspaceClient from './src/screens/client/EspaceClient';
import EspaceCommercant from './src/screens/commercant/EspaceCommercant';
import EspaceLivreur from './src/screens/livreur/EspaceLivreur';
import { couleurs } from './src/theme';

const ESPACES = {
  client: EspaceClient,
  livreur: EspaceLivreur,
  commercant: EspaceCommercant,
};

export default function App() {
  const [role, setRole] = useState(null);

  // Bouton « retour » Android : revenir au choix du rôle.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (role) {
        setRole(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [role]);

  const Espace = role ? ESPACES[role] : null;

  return (
    <SafeAreaProvider>
      <AppProvider>
        <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
          {Espace ? <Espace onQuitter={() => setRole(null)} /> : <ChoixRole onChoisir={setRole} />}
        </SafeAreaView>
        <StatusBar style="dark" />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: couleurs.fond },
});
